const Sequelize = require('sequelize');
var express = require('express');
var router = express.Router();
var models  = require('../models');
var routeHelpers = require('../helpers/routeHelpers');
const Op = Sequelize.Op;


router.route('/posts/boosts')

.get(routeHelpers.isLoggedIn, async function(req, res){

  //boosted_posts is an array of arrays, each containing a post and the post's boosters

  try {
    let auth_user = await models.Source.findById(req.user.id);
    let followees_prom = auth_user.getFollows();
    let trusteds_prom = auth_user.getTrusteds();
    let mutes_prom = auth_user.getMutes();

    let [followees, trusteds, mutes] = await Promise.all([followees_prom, trusteds_prom, mutes_prom]);

    let booster_candidates = new Set([...followees, ...trusteds]);
    let unmuted_boosters = [...booster_candidates].filter(booster => !mutes.includes(booster));

    let post_boost_promises = []
    unmuted_boosters.map(followee => post_boost_promises.push(followee.getPostBoosts()));
    let post_boosts = await Promise.all(post_boost_promises); //boosted posts by followee and trusteds excluding mutes

    let unique_post_ids = [];
    let unique_post_boosts = []; //contains elements of the form [post, [boosters]]

    for (let i = 0 ; i < post_boosts.length ; i++){
      for (let j = 0 ; j < post_boosts[i].length; j++){

        if (!unique_post_ids.includes(post_boosts[i][j].id)){
          unique_post_boosts.push([post_boosts[i][j], [unmuted_boosters[i]]])
        }
        else{
          let index = unique_post_ids.indexOf(post_boosts[i][j].id);
          unique_post_boosts[index][1].push(unmuted_boosters[i])
        }
      }

    }


    //crediblity criteria
    let cred_sources;
    if (req.headers.source == "trusted")
        cred_sources = trusteds;
    else if (req.headers.source == "me")
        cred_sources = [auth_user];
    else if (req.headers.source == "usernames") //as is, you can check anyone's opinion, doesn't need to be followed or trusted by you
       {
         let source_promises = [];
         req.headers.source_usernames.split(',').map( src =>{
           source_promises.push(models.Source.findOne({where: {userName: src}}));
         })
         cred_sources = await Promise.all(source_promises);
       }
    else
      cred_sources = followees.filter(followee => !mutes.includes(followee));


    let cred_source_ids = cred_sources.map(source => source.id);
    console.log("cred_source_ids", cred_source_ids)

    let post_assessment_promises = [];
    unique_post_boosts.map(post_booster => {
       post_assessment_promises.push(post_booster[0].getPostAssessments({where: {SourceId: {[Op.in]: cred_source_ids }}}));
      })

    let post_assessments = await Promise.all(post_assessment_promises);


    let confirmed = [], debated = [], refuted = [], all = [];
    //each array is of the form: [ [ [post, [booster_sources]], [assessments]], ... ]
    //all also contains posts with no assessments

    for (let i = 0 ; i < post_assessments.length ; i++){
       let credibility = post_assessments[i].map(assessment => assessment.postCredibility);

       if (credibility.length) {

         if (credibility.every(function(value){return value == 1 }))
           confirmed.push([unique_post_boosts[i], post_assessments[i]]);
         else if (credibility.every(function(value){return value == 0 }))
           refuted.push([unique_post_boosts[i], post_assessments[i]]);
         else
           debated.push([unique_post_boosts[i], post_assessments[i]]);
       }

       all.push([unique_post_boosts, post_assessments[i]]);

     }


     if (req.headers.validity == "confirmed")
       res.send(JSON.stringify(confirmed));
     else if (req.headers.validity == "refuted")
       res.send(JSON.stringify(refuted));
     else if (req.headers.validity == "debated")
       res.send(JSON.stringify(debated));
     else
       res.send(JSON.stringify(all));

  }
  catch(err){
    console.log(err);
    res.send(err);
  };
  //
  // models.Source.findById(req.user.id)
  // .then( user => {
  //   auth_user = user;
  //   return user.getFollows();
  // }).then( follows => {
  //   user_follows = follows;
  //   let post_boost_promises = []
  //   follows.map( post_boost_promises.push(follow.getPostBoosts()));
  //   return Promise.all(post_boost_promises);
  // }).then( followees_posts => {
  //
  //   let unique_posts_ids = [];
  //
  //   for (let i = 0 ; i < followees_posts.length ; i++) {
  //     for (let j = 0 ; j < i.length ; j++ ){
  //
  //       let post_index = unique_posts_ids.indexOf(followees_posts[i][j].id);
  //
  //       if ( post_index == -1){
  //         boosted_posts.push([followees_posts[i][j], [user_follows[i]]])
  //         unique_posts_ids.push(followees_posts[i][j].id);
  //       }
  //       else {
  //         boosted_posts[index][1].push(user_follows[i]);
  //       }
  //
  //     }
  //   }
  //
  //   if (req.headers.source == "trusted")
  //        return auth_user.getTrusteds();
  //    else if (req.headers.source == "me")
  //        return auth_user; //TODO:check to see if this works
  //    else if (req.headers.source == "usernames") //as is, you can check anyone's opinion, doesn't need to be followed or trusted by you
  //      {
  //        let source_promises = [];
  //        req.headers.source_usernames.split(',').map( src =>{
  //            source_promises.push(models.Source.findOne({where: {userName: src}}));
  //        })
  //        return Promise.all(source_promises);
  //      }
  //    else
  //      return user.getFollows();
  //
  // })
  // .then( sources => {
  //   let source_ids = sources.map(source => source.id);
  //   let post_assessment_promises = [];
  //   boosted_posts.map((post, boosters) => {
  //     post_assessment_promises.push(post.getAssessments({where: {SourceId: {[Op.any]: source_ids }}}));
  //   })
  //
  //   return Promise.all(post_assessment_promises);
  // }).then(posts_assessments => {
  //   //array of array of assessments
  //
  //   let confirmed = [], debated = [], refuted = [], all = [];
  //   //each array is of the form: [ [ [post, [booster_sources]], [assessments]], ... ]
  //   //all also contains posts with no assessments
  //
  //   for (let i = 0 ; i < posts_assessments.length ; i++){
  //     let credibility = posts_assessments[i].map(assessment => assessment.postCredibility);
  //
  //     if (! credibility.length) //TODO: check for correctness
  //       all.push([boosted_posts, posts_assessments[i]]);
  //
  //     else {
  //
  //       if (credibility.every(function(value){return value == 1 }))
  //         confirmed.push([boosted_posts, posts_assessments[i]]);
  //       else if (credibility.every(function(value){return value == 0 }))
  //         refuted.push([boosted_posts, posts_assessments[i]]);
  //       else
  //         debated.push([boosted_posts, posts_assessments[i]]);
  //
  //       all.push([boosted_posts, posts_assessments[i]]);
  //     }
  //
  //
  //   }
  //
  //   //TODO: possibly jsonify
  //   if (req.headers.validity == "confirmed")
  //     res.send(confirmed);
  //   else if (req.headers.validity == "refuted")
  //     res.send(refuted);
  //   else if (req.headers.validity == "debated")
  //     res.send(debated);
  //   else
  //     res.send(all);
  //
  // }).catch(err => {
  //   res.send(err);
  // })


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
    let auth_user = models.Source.findById(req.user.id);
    return Promise.all([boosted_post, auth_user])
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

.post(routeHelpers.isLoggedIn, async function(req, res) {

  try{
    let post_specs = routeHelpers.getSpecifictions(req.body);

    let post_prom = models.Post.create(post_specs);
    let auth_user_prom = models.Source.findById(req.user.id);

    //when a source initiates a post, a credibility assessment is automatically generated
    //for post, with the source as the sourceId and a value of "valid"
    let assessment_prom = models.Assessment.create({postCredibility: 1});

    let [post, auth_user, assessment] = await Promise.all([post_prom, auth_user_prom, assessment_prom]);

    let initiates_post = auth_user.addInitiatedPost(post);
    let boosts = auth_user.addPostBoost(post);
    let post_assessment = post.addPostAssessment(assessment);
    let source_assessment = auth_user.addSourceAssessment(assessment);

    await Promise.all([initiates_post, boosts, post_assessment, source_assessment]);

    res.redirect('/');
  }
  catch(e){
    console.log(e);
    res.send(e);
  }

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
