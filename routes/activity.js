var express = require('express');
var router = express.Router();
var db  = require('../models');
var routeHelpers = require('../lib/routeHelpers');
var boostHelpers = require('../lib/boostHelpers');
var wrapAsync = require('../lib/wrappers').wrapAsync;
var Sequelize = require('sequelize');
var db  = require('../models');

router.route('/activity/:username/:post_id')

.get(routeHelpers.isLoggedIn, wrapAsync(async function(req, res){

  let user = await db.Source.findOne({
    where: {
      userName: req.params.username
    }
  });

  let [boostersIds, _, followedTrustedIds] = await boostHelpers.getBoostersandCredSources(req);
  let postBoosts = await boostHelpers.getPostBoosts([req.params.post_id], req,
    boostersIds.concat(user.id), followedTrustedIds.concat(user.id), false);

  res.send(postBoosts[0]);
}));


router.route('/activity/:username')

.get(routeHelpers.isLoggedIn, wrapAsync(async function(req, res){

  let user = await db.Source.findOne({
    where: {
      userName: req.params.username
    }
  });

  let [boostersIds, credSources, followedTrustedIds] = await boostHelpers.getBoostersandCredSources(req);
  let [queryStr, replacements] = await boostHelpers.buildActivityQuery(req, user);

  let postIdObjs = await db.sequelize.query(queryStr,
  { replacements: replacements, type: Sequelize.QueryTypes.SELECT });
  let postIds = postIdObjs.map(el => el.id);

  let postBoosts = await boostHelpers.getPostBoosts(postIds, req,
    boostersIds.concat(user.id), followedTrustedIds.concat(user.id), false);

  res.send(postBoosts);
}));


module.exports = router;
