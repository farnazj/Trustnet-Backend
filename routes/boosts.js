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

  let [boosters_ids, cred_sources] = await boostHelpers.getBoostersandCredSources(req);
  let post_boosts = await boostHelpers.getPostBoosts([req.params.post_id], req, boosters_ids, cred_sources);

  res.send(post_boosts[0]);
}));


router.route('/boosts')

.get(routeHelpers.isLoggedIn, wrapAsync(async function(req, res){

  let [boosters_ids, cred_sources] = await boostHelpers.getBoostersandCredSources(req);
  let [query_str, replacements] = boostHelpers.buildBoostQuery(req, boosters_ids, cred_sources);

  let post_id_objs = await db.sequelize.query(query_str,
  { replacements: replacements, type: Sequelize.QueryTypes.SELECT });
  let post_ids = post_id_objs.map(el => el.id);
  let post_boosts = await boostHelpers.getPostBoosts(post_ids, req, boosters_ids, cred_sources);

  res.send(post_boosts);
}))


.post(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {
  let auth_user = await db.Source.findByPk(req.user.id);

  let assessment = await db.Assessment.findOne({
    where: {
        SourceId: req.user.id,
        PostId: req.body.post_id
      }
  });

  if (!assessment)
      throw "Cannot boost the post before assessing its credibility post: "
        + req.body.post_id + " user: " + req.user.id;

  await routeHelpers.boostPost(auth_user, req.body.post_id, req.body.target_usernames);
  res.send({}); //TODO: change
}));



module.exports = router;
