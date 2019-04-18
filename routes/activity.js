var express = require('express');
var router = express.Router();
var db  = require('../models');
var routeHelpers = require('../lib/routeHelpers');
var boostHelpers = require('../lib/boostHelpers');
var wrapAsync = require('../lib/wrappers').wrapAsync;

router.route('/activity/:username/:post_id')
.get(routeHelpers.isLoggedIn, wrapAsync(async function(req, res){
  let query = await boostHelpers.buildActivityQuery(req.params.username, req.params.post_id);

  let post_boosts = await db.Post.findAll({
    ...query,
    group: ['Boosteds.id', 'PostAssessments.id', 'Boosteds->Targets.id']
  });

  let results = boostHelpers.sliceResults(req, post_boosts);
  res.send(JSON.stringify(results[0]));
}));


router.route('/activity/:username')
.get(routeHelpers.isLoggedIn, wrapAsync(async function(req, res){
  let query = await boostHelpers.buildActivityQuery(req.params.username, false);

  let post_boosts = await db.Post.findAll({
    ...query,
    order: [
      [ 'updatedAt', 'DESC'],
      [ 'PostAssessments', 'updatedAt', 'DESC'],
    ],
    group: ['Post.id', 'Boosteds.id', 'PostAssessments.id', 'Boosteds->Targets.id']
  });

  let results = boostHelpers.sliceResults(req, post_boosts);
  res.send(JSON.stringify(results));
}));


module.exports = router;
