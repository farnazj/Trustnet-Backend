var express = require('express');
var router = express.Router();
var db  = require('../models');
var routeHelpers = require('../lib/routeHelpers');
var feedHelpers = require('../lib/feedHelpers');
var wrapAsync = require('../lib/wrappers').wrapAsync;
var constants = require('../lib/constants');
const Op = db.sequelize.Op;


router.route('/boosts')

.get(routeHelpers.isLoggedIn, wrapAsync(async function(req, res){

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
  if (req.headers.source == constants.CRED_SOURCES.TRUSTED)
      cred_sources = (await auth_user.getTrusteds()).map(source => {return source.id});
  else if (req.headers.source == constants.CRED_SOURCES.ME)
      cred_sources = [auth_user.id];
  else if (req.headers.source == constants.CRED_SOURCES.USERNAMES) //as is, you can check anyone's opinion, doesn't need to be followed or trusted by you
     {
       let source_promises = [];
       req.headers.source_usernames.split(',').map( src =>{
         source_promises.push(db.Source.findOne({where: {userName: src}}));
       });
       cred_sources = (await Promise.all(source_promises)).map(source => {return source.id});
     }
  else
    cred_sources = unmuted_boosters_ids;


  let post_boosts = await db.Boost.findAll({
    subQuery: false,
    include: [
      {
        model: db.Source,
        as: 'Boosters',
        where: {id: {[Op.in]: unmuted_boosters_ids }},
        attributes: {
          exclude: ["passwordHash"]
        },
        through: {
          attributes: []
        }
      },
      {
        model: db.Post,
        //as: 'Posts',
        include: [
          {
            model: db.Assessment,
            as: 'PostAssessments',
            where: {SourceId: {[Op.in]: cred_sources}}
          }
        ]
      }
    ],
    order: [['updatedAt', 'DESC']],
    // having: db.sequelize.where(db.sequelize.fn('AVG', db.sequelize.col('Post->PostAssessments.postCredibility')), {
    //      [Op.in]: validity_status,
    //    }),
    limit: 20,
    offset: req.query.offset ? parseInt(req.query.offset) : 0,
    group: ['Boost.id', 'Post.id', 'Boosters.id', 'Post->PostAssessments.id']
  })

  filtered_post_boosts = []

  //validity status
  let validity_status;
  if (req.headers.validity == constants.VALIDITY.CONFIRMED)
    filtered_post_boosts = post_boosts.filter(item => item.PostAssessments.every(x => x.postCredibility == 1));
  else if (req.headers.validity == constants.VALIDITY.REFUTED)
    filtered_post_boosts = post_boosts.filter(item => item.PostAssessments.every(x => x.postCredibility == 0));
  else if (req.headers.validity == constants.VALIDITY.DEBATED)
    filtered_post_boosts = post_boosts.filter(item => item.PostAssessments.some(x => x.postCredibility == 0) &&
     item.PostAssessments.some(x => x.postCredibility == 1));
  else //all
    filtered_post_boosts = post_boosts;

  res.send(JSON.stringify(post_boosts));
}))

.post(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {
  let auth_user = await db.Source.findById(req.user.id);

  let assessment = await db.Assessment.findOne({
    where: {
        SourceId: req.user.id,
        PostId: req.body.post_id
      }
  });

  if (!assessment)
      throw "Cannot boost the post before assessing its credibility";

  routeHelpers.boostPost(auth_user, req.body.post_id, req.body.target_usernames);
  res.send({}); //TODO: change
}))

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
