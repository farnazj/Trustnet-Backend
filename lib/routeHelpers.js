var db  = require('../models');
var constants = require('../lib/constants');
const Op = db.sequelize.Op;


function getSpecifictions(req_fields){

  let specifications = {};
  for (let key of Object.keys(req_fields)){
    specifications[key] = req_fields[key];
  }
  return specifications;
}

function getLimitOffset(req){
  let pagination_obj = {};
  for (let key of ['limit', 'offset']){
    if (req.query[key])
      pagination_obj[key] = parseInt(req.query[key]);
  }

  return pagination_obj;
}


function isLoggedIn(req, res, next) {

    // if user is authenticated in the session, carry on
    if (req.isAuthenticated())
        return next();

    // if user is not authenticated, redirect them to the home page
    res.redirect('/');
}

async function setBoostTargets(boost, header_targets) {

  let target_usernames = header_targets != null ? header_targets.split(',') : null;

  let target_promise;

  if (target_usernames) {
    console.log('((((((((((((()))))))))))))', target_usernames)
    let targets = await db.Source.findAll({
      where: {userName: {[Op.in]: target_usernames}}
    });

    target_promise = boost.addTargets(targets);
  }

  return target_promise;
}


async function boostPost(source, post_id, target_usernames) {

  let post = await db.Post.findById(post_id);

  return db.Boost.find({
    include: [ {
      model: db.Post,
      as: 'Posts',
      where: {
        id: post_id
      }
    }]
  })
  .then( async boost => {
    let promises = [];

    if (!boost){
      boost = await db.Boost.create({});
    }
    promises.push(...[
      post.addBoosted(boost),
      boost.addBooster(source),
      setBoostTargets(boost, target_usernames)
    ]);

  })
}


async function initiatePost(source, post, header_target_usernames) {

  let assessment_proms = db.Assessment.create(
    {postCredibility: constants.VALIDITY_CODES.CONFIRMED})
  .then(assessment => {
    return Promise.all([post.addPostAssessment(assessment),
    source.addSourceAssessment(assessment)]);
  });

  let boost_proms = db.Boost.create()
  .then(boost => {
    return Promise.all([ boost.addBooster(source),
    post.addBoosted(boost),
    setBoostTargets(boost, header_target_usernames)
    ]);
  })

  let post_prom = source.addInitiatedPost(post);

  return Promise.all([assessment_proms, boost_proms, post_prom]);
}

module.exports = {
  isLoggedIn,
	getSpecifictions,
  getLimitOffset,
  initiatePost,
  boostPost
};
