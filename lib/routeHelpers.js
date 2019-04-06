var db  = require('../models');
var constants = require('../lib/constants');
var ogpHelpers = require('./ogpHelpers');
const Op = db.sequelize.Op;
const logger = require('../lib/logger');

function getLimitOffset(req){
  let pagination_obj = {};
  for (let key of ['limit', 'offset']){
    if (req.query[key])
      pagination_obj[key] = parseInt(req.query[key]);
  }

  return pagination_obj;
}


function isLoggedIn(req, res, next) {

  logger.silly('checking isLoggedIn', req.headers.cookie)
    // if user is authenticated in the session, carry on
    if (req.isAuthenticated())
        return next();

    // if user is not authenticated
    res.status(401).send({'message':'unauthorized'});
}

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
    boost.addBooster(source),
    setBoostTargets(boost, target_usernames)
  ]);

  return Promise.all(promises);
}


async function boostPost(source, post_id, target_usernames) {
  let post = await db.Post.findById(post_id);
  await handleBoostPostRelations(source, post, target_usernames);

}


async function initiatePost(source, post, header_target_usernames) {

  let assessment_proms = db.Assessment.create(
    {postCredibility: constants.VALIDITY_CODES.CONFIRMED})
  .then(assessment => {
    return Promise.all([post.addPostAssessment(assessment),
    source.addSourceAssessment(assessment)]);
  });

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

}

module.exports = {
  isLoggedIn,
  getLimitOffset,
  initiatePost,
  boostPost,
  importPost
};
