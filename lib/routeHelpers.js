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
      promises.push(boost.setPost(post));
    }

    promises.push(boost.addBooster(source));

    return db.Source.findAll({
      where: {userName: {[Op.in]: target_usernames}}
    }).then(targets => {
      promises.push(boost.addTargets(targets));
      return promises;
    })

  })
}


async function initiatePost(source, post) {

  let assessment_proms = db.Assessment.create(
    {postCredibility: constants.VALIDITY_CODES.CONFIRMED})
  .then(assessment => {
    return Promise.all([post.addPostAssessment(assessment),
    source.addSourceAssessment(assessment)]);
  });

  let boost_proms = db.Boost.create()
  .then(boost => {
    return Promise.all([ boost.addBooster(source),
    boost.setPost(post)]);
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
