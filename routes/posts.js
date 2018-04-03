const Sequelize = require('sequelize');
var express = require('express');
var router = express.Router();
var models  = require('../models');
var routeHelpers = require('../helpers/routeHelpers');
const Op = Sequelize.Op;


router.route('/posts/boosts')

.get(routeHelpers.isLoggedIn, function(req, res){

  let auth_user, user_follows, boosted_posts;
  //boosted_posts is an array of arrays, each containing a post and the post's boosters

  models.Source.findById(req.user.id)
  .then( user => {
    auth_user = user;
    return user.getFollows();
  }).then( follows => {
    user_follows = follows;
    let post_boost_promises = []
    follows.map( post_boost_promises.push(follow.getPostBoosts()));
    return Promise.all(post_boost_promises);
  }).then( followees_posts => {

    let unique_posts_ids = [];

    for (let i = 0 ; i < followees_posts.length ; i++) {
      for (let j = 0 ; j < i.length ; j++ ){

        let post_index = unique_posts_ids.indexOf(followees_posts[i][j].id);

        if ( post_index == -1){
          boosted_posts.push([followees_posts[i][j], [user_follows[i]]])
          unique_posts_ids.push(followees_posts[i][j].id);
        }
        else {
          boosted_posts[index][1].push(user_follows[i]);
        }

      }
    }

    if (req.headers.source == "trusted")
         return auth_user.getTrusteds();
     else if (req.headers.source == "me")
         return auth_user; //TODO:check to see if this works
     else if (req.headers.source == "usernames") //as is, you can check anyone's opinion, doesn't need to be followed or trusted by you
       {
         let source_promises = [];
         req.headers.source_usernames.split(',').map( src =>{
             source_promises.push(models.Source.findOne({where: {userName: src}}));
         })
         return Promise.all(source_promises);
       }
     else
       return user.getFollows();

  })
  .then( sources => {
    let source_ids = sources.map(source => source.id);
    let post_assessment_promises = [];
    boosted_posts.map((post, boosters) => {
      post_assessment_promises.push(post.getAssessments({where: {SourceId: {[Op.any]: source_ids }}}));
    })

    return Promise.all(post_assessment_promises);
  }).then(posts_assessments => {
    //array of array of assessments

    let confirmed = [], debated = [], refuted = [], all = [];
    //each array is of the form: [ [ [post, [booster_sources]], [assessments]], ... ]
    //all also contains posts with no assessments

    for (let i = 0 ; i < posts_assessments.length ; i++){
      let credibility = posts_assessments[i].map(assessment => assessment.postCredibility);

      if (! credibility.length) //TODO: check for correctness
        all.push([boosted_posts, posts_assessments[i]]);

      else {

        if (credibility.every(function(value){return value == 1 }))
          confirmed.push([boosted_posts, posts_assessments[i]]);
        else if (credibility.every(function(value){return value == 0 }))
          refuted.push([boosted_posts, posts_assessments[i]]);
        else
          debated.push([boosted_posts, posts_assessments[i]]);

        all.push([boosted_posts, posts_assessments[i]]);
      }


    }

    //TODO: possibly jsonify
    if (req.headers.validity == "confirmed")
      res.send(confirmed);
    else if (req.headers.validity == "refuted")
      res.send(refuted);
    else if (req.headers.validity == "debated")
      res.send(debated);
    else
      res.send(all);

  }).catch(err => {
    res.send(err);
  })


})

.post(routeHelpers.isLoggedIn, function(req, res) {

  models.Assessment.find({where:{
      SourceId: req.user.id,
      PostId: req.body.post_id
  }})
  .then( assessment => {
    if (!assessment) //TODO: check to see if the source has assessed the post yet
      throw "Cannot boost the post before assessing its credibility";

    let boosted_post = models.Post.findById(req.body.post_id);
    let authenticated_user = models.Source.findById(req.user.id);
    return Promise.all([boosted_post, authenticated_user])
  })
  .then( post_user => {
        return models.Assessment.find({where:{
          SourceId: req.user.id
        }})
        return post_user[0].addBooster(post_user[1]);
    }).then(result => {
      res.send(result);
    }).catch(err => {
      res.send(err);
    })

});

router.route('/posts/initiated')

.get(routeHelpers.isLoggedIn, function(req, res){

  models.Source.findById(req.user.id)
  .then( user => {
    return user.getInitiatedPosts();
  }).then( posts => {
    res.send(result);
  }).catch(err => {
    res.send(err);
  })

})

.post(routeHelpers.isLoggedIn, function(req, res) {

  let post_specs = getSpecifictions(req.body);

  let post = models.Post.create(post_specs);
  let user = models.Source.findById(req.user.id);

  Promise.all([post, user])
  .then( post_user => {
    let initiates = user.addInitiatedPost(post);
    let boosts = user.addPostBoost(post);
    return Promise.all([initiates, boosts]);
  })
  .then( result =>{
    res.redirect('/');
  }).catch(err => {
   res.send(err);
  });

});



router.route( '/posts/:post_id')

//TODO: need to change this if some posts become private
.get(routeHelpers.isLoggedIn, function(req, res){

  models.Post.findById(req.params.post_id).then(result =>{
    res.send(result);
  }).catch(err => res.send(err));
})

.delete(routeHelpers.isLoggedIn, function(req, res) {
  models.Post.destroy({
    where: {
      id: req.params.post_id,
      SourceId: req.user.id
    }
  }).then(function() {
    res.redirect('/');
  }).catch(function(err){
    res.send(err);
  });
})

.put(routeHelpers.isLoggedIn, function(req, res){

    let postSpecs = routeHelpers.getSpecifictions(req.body);

    models.Post.update(postSpecs,
      {where: {id: req.params.post_id,
      SourceId: req.user.id
    }}).then(result =>{
      res.redirect('/');

    }).catch(err => res.send(err));
});


module.exports = router;
