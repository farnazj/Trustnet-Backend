var Sequelize = require('sequelize');
var db  = require('../models');
var constants = require('../lib/constants');
var ogpHelpers = require('./ogpHelpers');
const Op = Sequelize.Op;
var bCrypt = require('bcrypt');
const logger = require('../lib/logger');
var kue = require('kue')
 , queue = kue.createQueue();


function getLimitOffset(req){
  let pagination_obj = {};
  for (let key of ['limit', 'offset']){
    if (req.query[key])
      pagination_obj[key] = parseInt(req.query[key]);
  }

  return pagination_obj;
}


function isLoggedIn(req, res, next) {

  logger.silly('checking isLoggedIn ' + req.headers.cookie)
    // if user is authenticated in the session, carry on
    if (req.isAuthenticated())
        return next();

    // if user is not authenticated
    res.status(401).send({'message':'unauthorized'});
}

//for generating hash of passwords
function generateHash(password) {
    return bCrypt.hash(password, bCrypt.genSaltSync(8), null); // a promise
};

async function setBoostTargets(boost, target_usernames) {

  let target_promise;

  if (target_usernames) {
    let targets = await db.Source.findAll({
      where: {userName: {[Op.in]: target_usernames}}
    });

    target_promise = boost.addTargets(targets);
  }
  return target_promise;
}


async function handleBoostPostRelations(source, post, target_usernames) {
  let boost = await db.Boost.create({});
  let promises = [];
  promises.push(...[
    post.addBoosted(boost),
    boost.setBooster(source),
    setBoostTargets(boost, target_usernames)
  ]);

  return Promise.all(promises);
}


async function boostPost(source, post_id, target_usernames) {
  let post = await db.Post.findByPk(post_id);
  await handleBoostPostRelations(source, post, target_usernames);

}


async function initiatePost(source, post, header_target_usernames) {

  let assessment = await db.Assessment.create(
    {
      postCredibility: constants.VALIDITY_CODES.CONFIRMED,
      isTransitive: false
    });

  let assessment_proms = Promise.all([post.addPostAssessment(assessment),
    source.addSourceAssessment(assessment)]);

  assessment_proms.then(proms => {
    queue.create('calcTransitiveAssessments', {postId: post.id})
    .priority('medium').save();
  })

  let post_prom = source.addInitiatedPost(post);
  let boost_proms = handleBoostPostRelations(source, post, header_target_usernames);

  return Promise.all([assessment_proms, boost_proms, post_prom]);
}


async function importPost(source, post_url, assessment_obj, target_usernames) {

  let existing_post = await db.Post.findOne({
    where: {url: post_url}
  });

  if (!existing_post) {

    try {
      let article_ogp = await ogpHelpers.getOGPArticle(post_url);

      let assessment_prom = db.Assessment.create(assessment_obj);

      let post_prom = db.Post.create({
        title: article_ogp.data.ogTitle,
        description: article_ogp.data.ogDescription,
        url: post_url,
        image: article_ogp.data.ogImage.url
      });

      let [post, assessment] = await Promise.all([post_prom, assessment_prom]);
      post.addPostAssessment(assessment),
      source.addSourceAssessment(assessment)

      queue.create('calcTransitiveAssessments', {postId: post.id})
      .priority('medium').save();

      handleBoostPostRelations(source, post, target_usernames);
    }
    catch(err) {
      if (err.errorDetails.code == 'ESOCKETTIMEDOUT' || err.errorDetails.code == 'ETIMEDOUT')
        {
          //tell user to try again later
        }
      else {
        //article doesn't conform to ogp
        //or database error
      }
    }

  }
  else { //if post already exists in the database
    let existing_assessments = await existing_post.getPostAssessments({
      where: {
        SourceId: source.id
      }
    });
    if (existing_assessments.length) {

      let assessmentSpecs = assessment_obj;
      assessmentSpecs.version = existing_assessments[0].version + 1;
      assessmentSpecs.isTransitive = false;
      await existing_assessments[0].update(assessmentSpecs);
    }
    else {
      await db.Assessment.create(assessment_obj);
    }
    queue.create('calcTransitiveAssessments', {postId: existing_post.id})
    .priority('medium').save();

    handleBoostPostRelations(source, existing_post, target_usernames);
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
