var express = require('express');
var router = express.Router();
var db  = require('../models');
var routeHelpers = require('../lib/routeHelpers');
var boostHelpers = require('../lib/boostHelpers');
var wrapAsync = require('../lib/wrappers').wrapAsync;

router.route('/boosts')

.get(routeHelpers.isLoggedIn, wrapAsync(async function(req, res){

  let query = await boostHelpers.buildQuery(req, false);

  let post_boosts = await db.Post.findAll({
    ...query,
    order: [
      [ 'updatedAt', 'DESC'],
      [ 'PostAssessments', 'updatedAt', 'DESC'],
    ],
    group: ['Post.id', 'Boosteds.id', 'PostAssessments.id', 'Boosteds->Boosters.id', 'Boosteds->Targets.id']
  })
  //temporarily
  let results = boostHelpers.sliceResults(req, post_boosts);
  //let post_ids = results.map(el => el.id);
  //let results = await boostHelpers.getPostBoosts(post_ids);

  res.send(JSON.stringify(results));
}))


.post(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {
  let auth_user = await db.Source.findById(req.user.id);

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

//get a boost from the auth_user's perspective
router.route('/boosts/:post_id')

.get(routeHelpers.isLoggedIn, wrapAsync(async function(req, res){
  let query = await boostHelpers.buildQuery(req, req.params.post_id);

  let post_boost = await db.Post.findAll({
    ...query,
    group: ['Boosteds.id', 'PostAssessments.id', 'Boosteds->Boosters.id', 'Boosteds->Targets.id']
  });

  res.send(post_boost[0]);
}));


module.exports = router;
