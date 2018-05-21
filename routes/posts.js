var express = require('express');
var router = express.Router();
var db  = require('../models');
var routeHelpers = require('../helpers/routeHelpers');
const Op = db.sequelize.Op;


router.route('/posts/boosts')

.get(routeHelpers.isLoggedIn, async function(req, res){

  console.log("avale get")
  try {
    let auth_user = await db.Source.findById(req.user.id);
    let mutes = await auth_user.getMutes();
    let mute_ids = mutes.map(muted => {return muted.id});

    let unmuted_boosters = await db.Source.findAll({
      where: {id: { [Op.notIn]: mute_ids }}
    })

    unmuted_boosters_ids = unmuted_boosters.map(booster => {return booster.id});

    //crediblity criteria
    let cred_sources;
    if (req.headers.source == "trusted")
        cred_sources = (await auth_user.getTrusteds()).map(source => {return source.id});
    else if (req.headers.source == "me")
        cred_sources = [auth_user.id];
    else if (req.headers.source == "usernames") //as is, you can check anyone's opinion, doesn't need to be followed or trusted by you
       {
         let source_promises = [];
         req.headers.source_usernames.split(',').map( src =>{
           source_promises.push(db.Source.findOne({where: {userName: src}}));
         });
         cred_sources = (await Promise.all(source_promises)).map(source => {return source.id});
       }
    else
      cred_sources = unmuted_boosters_ids;


      console.log("============", await db.sequelize.queryInterface.describeTable('Assessments'));
    //TODO: add pagination support
    let post_boosts = await db.Post.findAll({
      include: [
        {
          model: db.Source,
          as: 'Boosters',
          where: {id: {[Op.in]: unmuted_boosters_ids }}
        },
        {
          model: db.Assessment,
          as: 'PostAssessments',
          where: {SourceId: {[Op.in]: cred_sources}}
        }
      ],
      attributes: {include:[[db.sequelize.fn('AVG', db.sequelize.col("Assessments.postCredibility")), 'average']]},
      group: ['id'],
      limit: 20
    })
//
//
//group: ['id'],

    // let response;
    // if (req.headers.validity == "confirmed")
    //   response = post_boosts.filter(post => post.PostAssessments.every(function(assessment){return assessment.postCredibility == 1 }));
    // else if (req.headers.validity == "refuted")
    //   response = post_boosts.filter(post => post.PostAssessments.every(function(assessment){return assessment.postCredibility == 0 }));
    // else if (req.headers.validity == "debated")
    //   response = post_boosts.filter(post => post.PostAssessments.every(function(assessment){return assessment.postCredibility == 2 }));
    // else
    //   response = post_boosts;


    res.send(JSON.stringify(post_boosts));

    // let post_boost_promises = [];
    // unmuted_boosters.map(followee => post_boost_promises.push(followee.getPostBoosts()));
    // let post_boosts = await Promise.all(post_boost_promises.map(p => p.catch(() => undefined))); //boosted posts by followee and trusteds excluding mutes
    //
    // let unique_post_ids = [];
    // let unique_post_boosts = []; //contains elements of the form [post, [boosters]]
    //
    // for (let i = 0 ; i < post_boosts.length ; i++){
    //   for (let j = 0 ; j < post_boosts[i].length; j++){
    //
    //     if (!unique_post_ids.includes(post_boosts[i][j].id)){
    //       unique_post_boosts.push([post_boosts[i][j], [unmuted_boosters[i]]]);
    //       unique_post_ids.push(post_boosts[i][j].id);
    //     }
    //     else{
    //       let index = unique_post_ids.indexOf(post_boosts[i][j].id);
    //       unique_post_boosts[index][1].push(unmuted_boosters[i]);
    //     }
    //   }
    // }

    //crediblity criteria
  //   if (req.headers.source == "trusted")
  //       cred_sources = trusteds;
  //   else if (req.headers.source == "me")
  //       cred_sources = [auth_user];
  //   else if (req.headers.source == "usernames") //as is, you can check anyone's opinion, doesn't need to be followed or trusted by you
  //      {
  //        let source_promises = [];
  //        req.headers.source_usernames.split(',').map( src =>{
  //          source_promises.push(db.Source.findOne({where: {userName: src}}));
  //        })
  //        cred_sources = await Promise.all(source_promises);
  //      }
  //   else
  //     cred_sources = followees.filter(followee => !mutes.includes(followee));
  //
  //
  //   let cred_source_ids = cred_sources.map(source => source.id);
  //
  //   let post_assessment_promises = [];
  //   unique_post_boosts.map(post_booster => {
  //      post_assessment_promises.push(post_booster[0].getPostAssessments({where: {SourceId: {[Op.in]: cred_source_ids }}}));
  //    });
  //
  //   let post_assessments = await Promise.all(post_assessment_promises);
  //
  //
  //   let confirmed = [], debated = [], refuted = [], all = [];
  //   //each array is of the form: [ [ [post, [booster_sources]], [assessments]], ... ]
  //   //array all also contains posts with no assessments
  //
  //   for (let i = 0 ; i < post_assessments.length ; i++){
  //      let credibility = post_assessments[i].map(assessment => assessment.postCredibility);
  //
  //      if (credibility.length) {
  //
  //        if (credibility.every(function(value){return value == 1 }))
  //          confirmed.push([unique_post_boosts[i], post_assessments[i]]);
  //        else if (credibility.every(function(value){return value == 0 }))
  //          refuted.push([unique_post_boosts[i], post_assessments[i]]);
  //        else
  //          debated.push([unique_post_boosts[i], post_assessments[i]]);
  //      }
  //
  //      all.push([unique_post_boosts[i], post_assessments[i]]);
  //    }
  //
  //
  //    if (req.headers.validity == "confirmed")
  //      res.send(JSON.stringify(confirmed));
  //    else if (req.headers.validity == "refuted")
  //      res.send(JSON.stringify(refuted));
  //    else if (req.headers.validity == "debated")
  //      res.send(JSON.stringify(debated));
  //    else
  //      res.send(JSON.stringify(all));
  //
  }
  catch(err){
    console.log(err);
    res.send(err);
  };

})


.post(routeHelpers.isLoggedIn, function(req, res) {

  db.Assessment.find({where:{
      SourceId: req.user.id,
      PostId: req.body.post_id
  }})
  .then( assessment => {
    if (!assessment) //TODO: check to see if the source has assessed the post yet
      throw "Cannot boost the post before assessing its credibility";

    let boosted_post = db.Post.findById(req.body.post_id);
    let auth_user = db.Source.findById(req.user.id);
    return Promise.all([boosted_post, auth_user])
  })
  .then( post_user => {
        return db.Assessment.find({where:{
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

  db.Source.findById(req.user.id)
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

    let post_prom = db.Post.create(post_specs);
    let auth_user_prom = db.Source.findById(req.user.id);

    //when a source initiates a post, a credibility assessment is automatically generated
    //for post, with the source as the sourceId and a value of "valid"

    let [auth_user, post] = await Promise.all([auth_user_prom, post_prom]);

    await routeHelpers.initiatePost(auth_user, post);

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

  db.Post.findById(req.params.post_id).then(result =>{
    res.send(result);
  }).catch(err => res.send(err));
})

.delete(routeHelpers.isLoggedIn, function(req, res) {
  db.Post.destroy({
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

    db.Post.update(postSpecs,
      {where: {id: req.params.post_id,
      SourceId: req.user.id
    }}).then(result =>{
      res.redirect('/');

    }).catch(err => res.send(err));
});


module.exports = router;
