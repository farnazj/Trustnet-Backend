var express = require('express');
var router = express.Router();
var db  = require('../models');
var routeHelpers = require('../helpers/routeHelpers');


router.route('/posts/:post_id/assessments')
//TODO: need to change this if some posts become private
.get(routeHelpers.isLoggedIn, function(req, res){

  let pagination_req = routeHelpers.getLimitOffset(req);

  db.Post.findById(req.params.post_id).then(async (post) =>{
    return post.getPostAssessments(
      pagination_req
    );
  }).then( assessments => {
    res.send(assessments);
  }).catch(err => res.send(err));
})


.post(routeHelpers.isLoggedIn, async function(req, res){

  try{
    let assessmentSpecs = routeHelpers.getSpecifictions(req.body);

    let assessment_prom = db.Assessment.create(assessmentSpecs);
    let auth_user_prom = db.Source.findById(req.user.id);
    let post_prom = db.Post.findById(req.params.post_id);

    let [post, auth_user, assessment] = await Promise.all([post_prom, auth_user_prom, assessment_prom]);

    let source_assessment = auth_user.addSourceAssessment(assessment);
    let post_assessment = post.addPostAssessment(assessment);

    await Promise.all([source_assessment, post_assessment]);

    res.send({}); //TODO: change

  }
  catch (err){
    console.log(err);
    res.send(err);
  }

})

.put(routeHelpers.isLoggedIn, function(req, res){

    let assessmentSpecs = routeHelpers.getSpecifictions(req.body);

    db.Assessment.findById(req.params.assessment_id)
    .then(assessment => {
      assessmentSpecs.version = assessment.version + 1;
      return assessment.update(assessmentSpecs);
    })
    .then(result =>{
      res.redirect('/');
    }).catch(err => res.send(err));

});

module.exports = router;
