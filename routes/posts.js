var express = require('express');
var router = express.Router();
var db  = require('../models');
var routeHelpers = require('../helpers/routeHelpers');
const Op = db.sequelize.Op;


router.route('/posts/boosts')

.get(routeHelpers.isLoggedIn, async function(req, res){

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


    //validity status
    let validity_status;
    if (req.headers.validity == "confirmed")
      validity_status = [1];
    else if (req.headers.validity == "refuted")
      validity_status = [0];
    else if (req.headers.validity == "debated")
      validity_status = [2];
    else //all
      validity_status = [0, 1, 2];


    let post_boosts = await db.Post.findAll({
      subQuery: false,
      include: [
        {
          model: db.Source,
          as: 'Boosters',
          where: {id: {[Op.in]: unmuted_boosters_ids }}
         }
        ,{
          model: db.Assessment,
          as: 'PostAssessments',
          where: {SourceId: {[Op.in]: cred_sources}}
        }
      ],
      // attributes: {include: [[db.sequelize.fn('AVG', db.sequelize.col('PostAssessments.postCredibility')), 'average']]},
      order: [['updatedAt', 'DESC']],
      having: db.sequelize.where(db.sequelize.fn('AVG', db.sequelize.col('PostAssessments.postCredibility')), {
           [Op.in]: validity_status,
         }),
      limit: 20,
      offset: req.query.offset ? parseInt(req.query.offset) : 0,
      group: ['Post.id', 'Boosters.id', 'PostAssessments.id']
    })

    // let response;
    // if (req.headers.validity == "confirmed")
    //   response = post_boosts.filter(post => post.PostAssessments.every(function(assessment){return assessment.postCredibility == 1 }));

    res.send(JSON.stringify(post_boosts));
  }
  catch(err){
    console.log(err);
    res.send(err);
  };

})


.post(routeHelpers.isLoggedIn, function(req, res) {

  db.Assessment.findOne({where:{
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
        return post_user[0].addBooster(post_user[1]);
    }).then(result => {
      res.send(result);
    }).catch(err => {
      res.send(err);
    })

});


router.route('/posts/initiated')

.get(routeHelpers.isLoggedIn, function(req, res){

  let pagination_req = routeHelpers.getLimitOffset(req);

  db.Source.findById(req.user.id)
  .then( user => {
    return user.getInitiatedPosts(pagination_req);
  }).then( result => {
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
  }).then(() => {
    res.redirect('/');
  }).catch(function(err){
    res.send(err);
  });
})


.put(routeHelpers.isLoggedIn, function(req, res){

    let postSpecs = routeHelpers.getSpecifictions(req.body);

    db.Post.findById(req.params.post_id)
    .then(post => {
      postSpecs.version = post.version + 1;
      return post.update(postSpecs);
    })
    .then(result =>{
      res.redirect('/');
    }).catch(err => res.send(err));
});


module.exports = router;
