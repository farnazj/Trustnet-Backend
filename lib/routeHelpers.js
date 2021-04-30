var Sequelize = require('sequelize');
var db  = require('../models');
var constants = require('../lib/constants');
var metaScraperHelpers = require('./metaScraperHelpers');
var communications = require('../lib/communications');
var moment = require('moment');
const Op = Sequelize.Op;
var bCrypt = require('bcrypt');
const logger = require('../lib/logger');
const psl = require('psl');
var util = require('../lib/util');
const { v4: uuidv4 } = require('uuid');

// var kue = require('kue')
//  , queue = kue.createQueue();


function getLimitOffset(req) {

  let paginationObj = {};
  for (let key of ['limit', 'offset']){
    if (req.query[key])
      paginationObj[key] = parseInt(req.query[key]);
  }

  return paginationObj;
}


function isLoggedIn(req, res, next) {

  logger.silly('checking isLoggedIn ' + req.headers.cookie);
  // if user is authenticated in the session, carry on
  if (req.isAuthenticated())
      return next();

  // if user is not authenticated
  res.status(401).send({ message:'unauthorized' });
}

//for generating hash of passwords
function generateHash(password) {
  return bCrypt.hash(password, bCrypt.genSaltSync(8), null); // a promise
};

async function setBoostTargets(source, boost, targetUsernames, targetLists, post) {

  let targetPromise;
  let targets = [];

  if (targetUsernames) {
    targets.push(...await db.Source.findAll({
      where: {
        userName: {[Op.in]: targetUsernames}
      }
    }));
  }

  if (targetLists) {
    targets.push(...await db.Source.findAll({
      where: {
        id: {
          [Op.notIn]: targets.map(el => el.id)
        }
      },
      include: [{
        model: db.SourceList,
        as: 'EntityLists',
        where: {
          id: {
            [Op.in]: targetLists
          },
          SourceId: source.id
        }
      }]
    }));
  }

  communications.notifyBoostTargets(targets, source, post.id);
  targetPromise = boost.addTargets(targets);

  return targetPromise;
}


async function handleBoostPostRelations(source, post, modifyBoostTimeStamp, targetUsernames, targetLists) {

  let boostSpecs = {};
  if (modifyBoostTimeStamp)
    boostSpecs.createdAt = post.publishedDate;

  let boost = await db.Boost.create(boostSpecs);
  let promises = [];
  promises.push(...[
    post.addPostBoost(boost),
    boost.setBooster(source),
    setBoostTargets(source, boost, targetUsernames, targetLists, post)
  ]);

  return Promise.all(promises);
}


async function boostPost(source, postId, targetUsernames, targetLists) {

  let post = await db.Post.findByPk(postId);
  await handleBoostPostRelations(source, post, false, targetUsernames, targetLists);
}


async function initiatePost(source, post, modifyBoostTimeStamp, targetUsernames, targetLists) {

  let assessment = await db.Assessment.create({
    postCredibility: constants.ACCURACY_CODES.CONFIRMED,
    isTransitive: false
  });

  let assessmentProms = Promise.all([post.addPostAssessment(assessment),
    source.addSourceAssessment(assessment)]);

  // assessmentProms.then(proms => {
  //   queue.create('newAssessmentPosted', {postId: post.id, sourceId: source.id})
  //   .priority('medium').removeOnComplete(true).save();
  // })

  let postProm = source.addInitiatedPost(post);
  let boostProms = handleBoostPostRelations(source, post, modifyBoostTimeStamp, targetUsernames, targetLists);

  return Promise.all([assessmentProms, boostProms, postProm]);
}


async function importPost(postUrl, source, assessmentObj, targetUsernames, targetLists) {

  let existingPost = await db.Post.findOne({
    where: { url: postUrl }
  });

  if (!existingPost) {

    try {
      let articleMetaData = await metaScraperHelpers.getArticleMetaData(postUrl);

      let post = await db.Post.create({
        title: articleMetaData.title,
        description: articleMetaData.description,
        body: articleMetaData.description,
        url: postUrl,
        image: articleMetaData.image,
        author: articleMetaData.author,
        publishedDate: articleMetaData.date ? articleMetaData.date : moment.utc()
      });

      if (assessmentObj) {
        let assessment = await db.Assessment.create(assessmentObj)
        await Promise.all([post.addPostAssessment(assessment),
        source.addSourceAssessment(assessment)]);
      }

      if (articleMetaData.publisher) {

        let feed = await db.Feed.findOne({
          where: {
            name: articleMetaData.publisher
          }
        });

        let articleSource, created;

        if (feed) {

          //console.log('found feed\n', feed)
          if (psl.get(util.extractHostname(feed.rssfeed)) == psl.get(util.extractHostname(post.url))) {
            articleSource = await db.Source.findByPk(feed.SourceId);
          }
          else {
            //console.log('urls not matched\n', psl.get(util.extractHostname(feed.rssfeed)), util.extractHostname(post.url))
            let results = await findOrCreateSource(articleMetaData.publisher);
            articleSource = results[0];
            created = results[1];
          }

        }
        else {
          //console.log('feed not found\n')
          let results = await findOrCreateSource(articleMetaData.publisher);
          articleSource = results[0];
          created = results[1];
        }

        if (!articleSource.photoUrl)
          articleSource.update({ photoUrl: articleMetaData.logo });

        let articleSourceAssessment = await db.Assessment.create({
          postCredibility: constants.ACCURACY_CODES.CONFIRMED,
          isTransitive: false,
          sourceIsAnonymous: false
        })

        await Promise.all([
          articleSource.addInitiatedPost(post),
          handleBoostPostRelations(articleSource, post, true),
          post.addPostAssessment(articleSourceAssessment),
          articleSource.addSourceAssessment(articleSourceAssessment)
        ]);

      }
 
      // queue.create('newAssessmentPosted', {postId: post.id, sourceId: source.id})
      // .priority('medium').removeOnComplete(true).save();

      await handleBoostPostRelations(source, post, false, targetUsernames, targetLists);
    }
    catch(err) {
      
      /*the if condition raises an exception if errorDetails is no available, e.g., if the article
      does not have ogp tags.
      */
      if (err.errorDetails.code && (err.errorDetails.code == 'ESOCKETTIMEDOUT' || err.errorDetails.code == 'ETIMEDOUT'))
        {
          //tell user to try again later
        }
      else {
        //article doesn't conform to ogp
        //or database error
        //TODO: handle error
      }
    }

  }
  else { //if post already exists in the database

    if (source) {
      let existingAssessments = await existingPost.getPostAssessments({
        where: {
          SourceId: source.id
        }
      });
      if (existingAssessments.length) {
  
        for (let existingAssessment of existingAssessments)
          existingAssessment.update({ version: existingAssessment.version - 1 });
      }
      
      let assessment = await db.Assessment.create(assessmentObj);
      await Promise.all([
        existingPost.addPostAssessment(assessment),
        source.addSourceAssessment(assessment),
        existingPost.removeSeer(source)]);
  
      await markPostAsUnseenAfterAssessment(existingPost, source.id);
    
      // queue.create('newAssessmentPosted', {postId: existingPost.id, sourceId: source.id})
      // .priority('medium').removeOnComplete(true).save();
  
      await handleBoostPostRelations(source, existingPost, false, targetUsernames, targetLists);
    }
    
  }

}

async function findOrCreateSource(claimedName) {

  let entityPassword = await generateHash(process.env.ADMIN_KEY);

  let proms = db.Source.findOrCreate({
    where: {
      userName: claimedName,
    },
    defaults: {
      systemMade: true,
      passwordHash: entityPassword,
      email: null,
      isVerified: true
    }
  })

  return proms;
}


async function markPostAsUnseenAfterAssessment(post, authUserId) {

  let targets = await db.Source.findAll({
    where: {
      [Op.or]: [{
        '$Trusteds.id$': {
          [Op.in]: [authUserId]
        }
      }, {
        '$Follows.id$': {
          [Op.in]: [authUserId]
        }
      }]
      
    },
    include: [{
      model: db.Source,
      as: 'Trusteds'
    }, {
      model: db.Source,
      as: 'Follows'
    }]
  })

  let removeSeerProms = [];
  targets.forEach(target => {
    removeSeerProms.push(post.removeSeer(target));
  })

  return Promise.all(removeSeerProms);

}

async function makeOrFindAccountOnBehalf(emails) {

  let entityPassword = await generateHash(process.env.ADMIN_KEY);

  let accountProms = emails.map(email => {
    return db.Source.findOrCreate({
      where: {
        email: email,
        isVerified: false
      },
      defaults: {
        passwordHash: entityPassword,
        systemMade: true,
        userName: uuidv4()
      }
    })
  })
  
  let accounts = (await Promise.all(accountProms)).map(el => el[0]);
  return accounts;
}


module.exports = {
  isLoggedIn,
  generateHash,
  getLimitOffset,
  initiatePost,
  boostPost,
  importPost,
  markPostAsUnseenAfterAssessment,
  makeOrFindAccountOnBehalf
};
