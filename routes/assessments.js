var express = require('express');
var router = express.Router();
var models  = require('../models');
var routeHelpers = require('../helpers/routeHelpers');


router.route('/posts/:post_id/assessments')
//TODO: need to change this if some posts become private
.get(routeHelpers.isLoggedIn, function(req, res){

  models.Post.findById(req.params.post_id).then(post =>{
    models.Assessment.findAll({where: {PostId: post.id}});
  }).then( assessments => {
    res.send(assessments);
  }).catch(err => res.send(err));
})


.post(routeHelpers.isLoggedIn, async function(req, res){

  try{
    let assessmentSpecs = routeHelpers.getSpecifictions(req.body);

    let assessment_prom = models.Assessment.create(assessmentSpecs);
    let auth_user_prom = models.Source.findById(req.user.id);
    let post_prom = models.Post.findById(req.params.post_id);

    let [post, auth_user, assessment] = await Promise.all([post_prom, auth_user_prom, assessment_prom]);

    let source_assessment = auth_user.addSourceAssessment(assessment);
    let post_assessment = post.addPostAssessment(assessment);

    await Promise.all([source_assessment, post_assessment]);

    res.redirect('/'); //TODO: change

  }
  catch (err){
    console.log(err);
    res.send(err);
  }


})

module.exports = router;
