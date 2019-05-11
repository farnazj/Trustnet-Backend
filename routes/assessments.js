var express = require('express');
var router = express.Router();
var db  = require('../models');
var routeHelpers = require('../lib/routeHelpers');
var wrapAsync = require('../lib/wrappers').wrapAsync;
var kue = require('kue')
 , queue = kue.createQueue();

router.route('/posts/:post_id/assessments')
//TODO: need to change this if some posts become private
.get(routeHelpers.isLoggedIn, wrapAsync(async function(req, res){

  let pagination_req = routeHelpers.getLimitOffset(req);

  let post = await db.Post.findOne({
    where: {id: req.params.post_id},
    include: [
      {
        model: db.Assessment,
        as: 'PostAssessments'
      }
    ]
  })

  res.send(post.PostAssessments);
}))

//post or update assessment
.post(routeHelpers.isLoggedIn, wrapAsync(async function(req, res){

  let assessments = await db.Assessment.findAll({
    where: {
      SourceId: req.user.id,
      PostId: req.params.post_id
    },
    order: [
      [ 'version', 'DESC'],
    ]
  });

  let assessmentSpecs = req.body;
  assessmentSpecs.isTransitive = false;

  if (assessments.length) {

    for (let assessment of assessments)
      assessment.update({ version: assessment.version - 1});
  }

  let auth_user_prom = db.Source.findByPk(req.user.id);
  let post_prom = db.Post.findByPk(req.params.post_id);

  let assessment_prom = db.Assessment.create(assessmentSpecs);

  let [post, auth_user, assessment] = await Promise.all([post_prom, auth_user_prom, assessment_prom]);

  let source_assessment = auth_user.addSourceAssessment(assessment);
  let post_assessment = post.addPostAssessment(assessment);

  await Promise.all([source_assessment, post_assessment]);

  queue.create('calcTransitiveAssessments', {postId: req.params.post_id})
  .priority('medium').save();

  res.send({message: 'Assessment posted'});
}))


router.route('/posts/:post_id/:user_id/assessment')

.get(routeHelpers.isLoggedIn, wrapAsync(async function(req, res){

  let assessments = await db.Assessment.findAll({
    where: {
      SourceId: req.user.id,
      PostId: req.params.post_id
    },
    order: [
      [ 'version', 'DESC'],
    ]
  });

  res.send(assessments);
}))

module.exports = router;
