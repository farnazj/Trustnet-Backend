var express = require('express');
var router = express.Router();
var db  = require('../models');
var routeHelpers = require('../lib/routeHelpers');
var wrapAsync = require('../lib/wrappers').wrapAsync;


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

  let assessment = await db.Assessment.findOne({where: {
    SourceId: req.user.id,
    PostId: req.params.post_id
  }});

  if (!assessment) {
    let auth_user_prom = db.Source.findByPk(req.user.id);
    let post_prom = db.Post.findByPk(req.params.post_id);

    let assessment_prom = db.Assessment.create({...req.body, isTransitive: false});

    let [post, auth_user, assessment] = await Promise.all([post_prom, auth_user_prom, assessment_prom]);

    let source_assessment = auth_user.addSourceAssessment(assessment);
    let post_assessment = post.addPostAssessment(assessment);

    await Promise.all([source_assessment, post_assessment]);
  }
  else {
    let assessmentSpecs = req.body;
    assessmentSpecs.version = assessment.version + 1;
    await assessment.update(assessmentSpecs);
  }

  res.send({message: 'Assessment posted'});

}))


router.route('/posts/:post_id/:user_id/assessment')

.get(routeHelpers.isLoggedIn, wrapAsync(async function(req, res){

  let source = await db.Source.findOne({
    where: {
      id: req.params.user_id
    },
    include: [{
      model: db.Assessment,
      as: 'SourceAssessments',
      where: {PostId: req.params.post_id}
    }]
  });

  if (source)
    result = source.SourceAssessments[0];
  else
    result = {}

  res.send(result);
}))

.put(routeHelpers.isLoggedIn, wrapAsync(async function(req, res){

    let assessmentSpecs = routeHelpers = req.body;
    let assessment = await db.Assessment.findByPk(req.params.assessment_id);
    assessmentSpecs.version = assessment.version + 1;
    await assessment.update(assessmentSpecs);

    res.send({message: 'Assessment updated'});

}));

module.exports = router;
