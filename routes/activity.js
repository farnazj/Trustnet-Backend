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
  let user = await db.Source.findOne(
    {where: {userName: req.params.username}
  });

  let [boosters_ids, cred_sources] = await boostHelpers.getBoostersandCredSources(req);
  let post_boosts = await boostHelpers.getPostBoosts([req.params.post_id], req,
    boosters_ids.concat(user.id), cred_sources.concat(user.id));

  res.send(post_boosts[0]);
}));


router.route('/activity/:username')
.get(routeHelpers.isLoggedIn, wrapAsync(async function(req, res){
  
  let user = await db.Source.findOne(
    {where: {userName: req.params.username}
  });

  let [boosters_ids, cred_sources] = await boostHelpers.getBoostersandCredSources(req);
  let [query_str, replacements] = await boostHelpers.buildActivityQuery(req, false);

  let post_id_objs = await db.sequelize.query(query_str,
  { replacements: replacements, type: Sequelize.QueryTypes.SELECT });
  let post_ids = post_id_objs.map(el => el.id);

  let post_boosts = await boostHelpers.getPostBoosts(post_ids, req,
    boosters_ids.concat(user.id), cred_sources.concat(user.id));

  res.send(post_boosts);
}));


module.exports = router;
