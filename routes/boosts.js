var express = require('express');
var router = express.Router();
var db  = require('../models');
var routeHelpers = require('../lib/routeHelpers');
var boostHelpers = require('../lib/boostHelpers');
var wrapAsync = require('../lib/wrappers').wrapAsync;
var filterValidity = require('../lib/boostPatch');

router.route('/boosts')

.get(routeHelpers.isLoggedIn, wrapAsync(async function(req, res){

  let query = await boostHelpers.buildQuery(req, false);

  let post_boosts = await db.Post.findAll({
    ...query,
    order: [
      [ 'updatedAt', 'DESC'],
      [ 'PostAssessments', 'updatedAt', 'DESC'],
    ],
    group: ['Post.id', 'Boosteds.id', 'PostAssessments.id', 'Boosteds->Targets.id', 'Seers.id']
  })

  //temporarily
  let filtered_posts = filterValidity(post_boosts, req);
  let results = boostHelpers.sliceResults(req, filtered_posts);

  res.send(JSON.stringify(results));
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

//get a boost from the auth_user's perspective
router.route('/boosts/:post_id')

.get(routeHelpers.isLoggedIn, wrapAsync(async function(req, res){
  let query = await boostHelpers.buildQuery(req, req.params.post_id);

  let post_boost = await db.Post.findAll({
    ...query,
    group: ['Boosteds.id', 'PostAssessments.id', 'Boosteds->Targets.id', 'Seers.id']
  });

  res.send(post_boost[0]);
}));


module.exports = router;
