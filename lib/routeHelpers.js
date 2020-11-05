var Sequelize = require('sequelize');
var db  = require('../models');
var constants = require('../lib/constants');
var metaScraperHelpers = require('./metaScraperHelpers');
var communications = require('../lib/communications');;
const Op = Sequelize.Op;
var bCrypt = require('bcrypt');
const logger = require('../lib/logger');
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


async function handleBoostPostRelations(source, post, targetUsernames, targetLists) {

  let boost = await db.Boost.create({});
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
  await handleBoostPostRelations(source, post, targetUsernames, targetLists);
}


async function initiatePost(source, post, targetUsernames, targetLists) {

  let assessment = await db.Assessment.create({
    postCredibility: constants.VALIDITY_CODES.CONFIRMED,
    isTransitive: false
  });

  let assessmentProms = Promise.all([post.addPostAssessment(assessment),
    source.addSourceAssessment(assessment)]);

  // assessmentProms.then(proms => {
  //   queue.create('newAssessmentPosted', {postId: post.id, sourceId: source.id})
  //   .priority('medium').removeOnComplete(true).save();
  // })

  let postProm = source.addInitiatedPost(post);
  let boostProms = handleBoostPostRelations(source, post, targetUsernames, targetLists);

  return Promise.all([assessmentProms, boostProms, postProm]);
}


async function importPost(source, postUrl, assessmentObj, targetUsernames, targetLists) {

  let existingPost = await db.Post.findOne({
    where: {url: postUrl}
  });

  if (!existingPost) {

    try {
      let articleMetaData = await metaScraperHelpers.getArticleMetaData(postUrl);
      let assessmentProm = db.Assessment.create(assessmentObj);

      let postProm = db.Post.create({
        title: articleMetaData.title,
        description: articleMetaData.description,
        body: articleMetaData.description,
        url: postUrl,
        image: articleMetaData.image,
        author: articleMetaData.author,
        publishedDate: articleMetaData.date ? articleMetaData.date : moment.utc()
      });

      let [post, assessment] = await Promise.all([postProm, assessmentProm]);
      post.addPostAssessment(assessment),
      source.addSourceAssessment(assessment)

      
      if (articleMetaData.publisher) {
        let entityPassword = await generateHash(process.env.ADMIN_KEY);

        let articleSourcePostProms = db.Source.findOrCreate({
          where: {
            userName: articleMetaData.publisher,
            photoUrl: articleMetaData.logo
          },
          defaults: {
            systemMade: true,
            passwordHash: entityPassword,
            email: null,
            isVerified: true
          }
        })
        .then( ([articleSource, created]) => {
          return [articleSource.addInitiatedPost(post), handleBoostPostRelations(articleSource, post)];
        })

        await articleSourcePostProms;
      }
 
      // queue.create('newAssessmentPosted', {postId: post.id, sourceId: source.id})
      // .priority('medium').removeOnComplete(true).save();

      handleBoostPostRelations(source, post, targetUsernames, targetLists);
    }
    catch(err) {
      console.log('error', err)
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
    let existingAssessments = await existingPost.getPostAssessments({
      where: {
        SourceId: source.id
      }
    });
    if (existingAssessments.length) {

      let assessmentSpecs = assessmentObj;
      assessmentSpecs.version = existingAssessments[0].version + 1;
      assessmentSpecs.isTransitive = false;
      await existingAssessments[0].update(assessmentSpecs);
    }
    else {
      await db.Assessment.create(assessmentObj);
    }
    // queue.create('newAssessmentPosted', {postId: existingPost.id, sourceId: source.id})
    // .priority('medium').removeOnComplete(true).save();

    handleBoostPostRelations(source, existingPost, targetUsernames, targetLists);
  }

}

module.exports = {
  isLoggedIn,
  generateHash,
  getLimitOffset,
  initiatePost,
  boostPost,
  importPost
};
