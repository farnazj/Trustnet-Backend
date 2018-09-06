var express = require('express');
var router = express.Router();
var db  = require('../models');
var routeHelpers = require('../helpers/routeHelpers');
var feedHelpers = require('../helpers/feedHelpers');
const Op = db.sequelize.Op;


router.route('/boosts')

.get(routeHelpers.isLoggedIn, async function(req, res){

  try {
    // let auth_user = await db.Source.findById(req.user.id);
    //
    // let follows = auth_user.getFollows();
    // let mutes = await auth_user.getMutes();
    // let mute_ids = mutes.map(muted => {return muted.id});
    //
    // let unmuted_boosters = await db.Source.findAll({
    //   where: {id: { [Op.and]: {
    //     [Op.notIn]: mute_ids,
    //     [Op.in]: follows
    //   }  }}
    // })
    //
    // unmuted_boosters_ids = unmuted_boosters.map(booster => {return booster.id});

    let auth_user_ = await db.Source.findOne({
      where: {
        id: req.user.id
      },
      include: [{
        model: db.Source,
        as: 'Follows',
        include: [{
          model: db.Feed,
          as: 'SourceFeeds'
        }]
      },
      {
        model: db.Source,
        as: 'Mutes'
      },
      {
        model: db.Source,
        as: 'Trusteds'
      }
      ]
    });

    let unmuted_boosters = auth_user_.Follows.filter(source => (!auth_user_.Mutes.map(muted_source => {return muted_source.id}).includes(source.id) ));

    await feedHelpers.updateRSSPosts(unmuted_boosters);

    let unmuted_boosters_ids = unmuted_boosters.map(booster => {return booster.id});

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


    let post_boosts = await db.Boost.findAll({
      subQuery: false,
      include: [
        {
          model: db.Source,
          as: 'Boosters',
          where: {id: {[Op.in]: unmuted_boosters_ids }}
        },
        {
          model: db.Post,
          as: 'Posts',
          include: [
            {
              model: db.Assessment,
              as: 'PostAssessments',
              where: {SourceId: {[Op.in]: cred_sources}}
            }
          ]
        }
      ],
      // attributes: {include: [[db.sequelize.fn('AVG', db.sequelize.col('PostAssessments.postCredibility')), 'average']]},
      order: [['updatedAt', 'DESC']],
      having: db.sequelize.where(db.sequelize.fn('AVG', db.sequelize.col('Posts->PostAssessments.postCredibility')), {
           [Op.in]: validity_status,
         }),
      limit: 20,
      offset: req.query.offset ? parseInt(req.query.offset) : 0,
      group: ['Boost.id', 'Posts.id', 'Boosters.id', 'Posts->PostAssessments.id']
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

.post(routeHelpers.isLoggedIn, async function(req, res) {

  try {
    let auth_user = await db.Source.findById(req.user.id);

    let assessment = await db.Assessment.findOne({
      where: {
          SourceId: req.user.id,
          PostId: req.body.post_id
        }
    });

    if (!assessment)
        throw "Cannot boost the post before assessing its credibility";

    let target_usernames = JSON.parse(req.body.target_usernames);
    routeHelpers.boostPost(auth_user, req.body.post_id, target_usernames);
    res.send({}); //TODO: change
  }
  catch(err) {
    console.log(err);
    res.send(err);
  }
});
//
// .post(routeHelpers.isLoggedIn, async function(req, res) {
//
//   try {
//     let assessment = await db.Assessment.findOne({where:{
//         SourceId: req.user.id,
//         PostId: req.body.post_id
//     }});
//     if (!assessment) //TODO: check to see if the source has assessed the post yet
//       throw "Cannot boost the post before assessing its credibility";
//
//       let boosted_post_pr = db.Post.findById(req.body.post_id);
//       let auth_user_pr = db.Source.findById(req.user.id);
//
//       let boosted_post, auth_user = await Promise.all([boosted_post_pr, auth_user_pr]);
//
//       let target_promises = [];
//       req.body.target_usernames.split(',').map( src =>{
//         target_promises.push(db.Source.findOne({where: {userName: src}}));
//       });
//
//       let targets = await Promise.all(target_promises);
//       let boost = await db.Boost.create();
//       boost.addBooster(auth_user);
//       boost.setTargets(targets);
//       boost.addPost()
//
//
//   }
//   catch(err) {
//     res.send(err);
//   }
//
//
//   .then( assessment => {
//
//
//
//     return Promise.all([boosted_post, auth_user])
//   })
//   .then( post_user => {
//         return
//     }).then(result => {
//       res.send(result);
//     }).catch(err => {
//       res.send(err);
//     })
//
// });

module.exports = router;
