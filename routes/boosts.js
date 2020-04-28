var express = require('express');
var router = express.Router();
var db  = require('../models');
var routeHelpers = require('../lib/routeHelpers');
var boostHelpers = require('../lib/boostHelpers');
var wrapAsync = require('../lib/wrappers').wrapAsync;
var filterValidity = require('../lib/boostPatch');
var Sequelize = require('sequelize');
var db  = require('../models');

//get a boost from the auth_user's perspective
router.route('/boosts/:post_id')

.get(routeHelpers.isLoggedIn, wrapAsync(async function(req, res){

  let exploreMode = req.headers.explore ? req.headers.explore == 'true' : false;

  let relations = await boostHelpers.getBoostersandCredSources(req);
  let postBoosts = await boostHelpers.getPostBoosts([req.params.post_id], req,
    relations, exploreMode, false);

  res.send(postBoosts[0]);
}));


router.route('/boosts')

.get(routeHelpers.isLoggedIn, wrapAsync(async function(req, res){

  let relations = await boostHelpers.getBoostersandCredSources(req);
  let exploreMode = req.headers.explore ? req.headers.explore == 'true' : false;

  if (exploreMode || (relations.boosters.length && relations.credSources.length)) {

    let [queryStr, replacements] = boostHelpers.buildBoostQuery(req, relations, exploreMode);

    let postIdObjs = await db.sequelize.query(queryStr,
    { replacements: replacements, type: Sequelize.QueryTypes.SELECT });

    let postIds = postIdObjs.map(el => el.id);
    let postBoosts = await boostHelpers.getPostBoosts(postIds, req, relations, exploreMode, false);

    res.send(postBoosts);
  }
  else
    res.send([]);
}))

.post(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  let authUserProm = db.Source.findByPk(req.user.id);
  let assessment = await db.Assessment.findOne({
    where: {
        SourceId: req.user.id,
        PostId: req.body.post_id
      }
  });

  if (!assessment)
      throw "Cannot boost the post before assessing its credibility post: "
        + req.body.post_id + " user: " + req.user.id;

  let authUser = await authUserProm;

  await routeHelpers.boostPost(authUser, req.body.post_id, req.body.target_usernames,
    req.body.target_lists);

  res.send({}); //TODO: change
}));


module.exports = router;
