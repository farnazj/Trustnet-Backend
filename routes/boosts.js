var express = require('express');
var router = express.Router();
var db  = require('../models');
var routeHelpers = require('../lib/routeHelpers');
var wrapAsync = require('../lib/wrappers').wrapAsync;
var constants = require('../lib/constants');
const Op = db.sequelize.Op;


router.route('/boosts')

.get(routeHelpers.isLoggedIn, wrapAsync(async function(req, res){

  console.time('auth-user');
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
  console.timeEnd('auth-user');

  let unmuted_boosters_ids = unmuted_boosters.map(booster => {return booster.id});

  //crediblity criteria
  console.time('credSource-criteria')

  let cred_sources;
  if (req.headers.source == constants.CRED_SOURCES.TRUSTED)
      cred_sources = auth_user_.Trusteds.map(source => {return source.id});
  else if (req.headers.source == constants.CRED_SOURCES.ME)
      cred_sources = [auth_user_.id];
  else if (req.headers.source == constants.CRED_SOURCES.USERNAMES) //as is, you can check anyone's opinion, doesn't need to be followed or trusted by you
     {
      let source_promises = [];
      if (!req.headers.source_usernames)
          cred_sources = [];
      else {
        req.headers.source_usernames.split(',').map( src =>{
          source_promises.push(db.Source.findOne({where: {userName: src}}));
        });
        cred_sources = (await Promise.all(source_promises)).map(source => {return source.id});
      }

     }
  else
    cred_sources = unmuted_boosters_ids;

    console.timeEnd('credSource-criteria')

  //validity status
  let having_statement;
  if (req.headers.validity == constants.VALIDITY_TYPES.CONFIRMED) {
    having_statement = {
      [Op.and] : {
        '$minValidity$': {
            $in: [1, 2] },
        '$maxValidity$': {
            $eq: 2}
      }
    }
  }
  else if (req.headers.validity == constants.VALIDITY_TYPES.REFUTED) {
    having_statement = {
      [Op.and] : {
        '$minValidity$': {
            $eq: 0},
        '$maxValidity$': {
            $in: [0, 1]}
      }
    }
  }
  else if (req.headers.validity == constants.VALIDITY_TYPES.DEBATED) {
    having_statement = {
      [Op.and] : {
        '$minValidity$': {
            $eq: 0},
        '$maxValidity$': {
            $eq: 2}
      }
    }
  }
  else { //all
    having_statement = {}
  }

  console.time('fetching-post-boosts');
  let post_boosts = await db.Post.findAll({
    subQuery: false,
    attributes: {
       include: [
         [db.sequelize.fn('MIN', db.sequelize.col('PostAssessments.postCredibility')), `minValidity`],
         [db.sequelize.fn('MAX', db.sequelize.col('PostAssessments.postCredibility')), `maxValidity`]
       ]
    },
    include: [
      {
        model: db.Boost,
        as: 'Boosteds',
        include: [
          {
            model: db.Source,
            as: 'Boosters',
            //where: {id: {[Op.in]: unmuted_boosters_ids }},
            attributes: {
              exclude: ["passwordHash"]
            },
            through: {
              attributes: []
            }
          },
          {
            model: db.Source,
            as: 'Targets',
            through: {
              attributes: []
            }
          }
        ],
        through: {
          attributes: []
        }
      },
      {
        model: db.Assessment,
        as: 'PostAssessments',
        //where: {SourceId: {[Op.in]: cred_sources}},
      }
    ],
    where: {
      [Op.and] : [{
        '$PostAssessments.SourceId$': {
          [Op.in]: cred_sources
        },
        '$Boosteds.Boosters.id$': {
          [Op.in]: unmuted_boosters_ids
        },
        '$Boosteds.Targets.id$': {
          [Op.or]: {
            [Op.eq]: null,
            [Op.in]: [req.user.id]
          }
        }
      }]
    },
    order: [['updatedAt', 'DESC']],
    having: having_statement,
    //having: db.sequelize.where(db.sequelize.fn('AVG', db.sequelize.col('Post->PostAssessments.postCredibility')), {
       //   [Op.in]: validity_status,
       // }),

    limit: req.query.limit ? parseInt(req.query.limit) : 15,
    offset: req.query.offset ? parseInt(req.query.offset) : 0,
    group: ['Post.id', 'Boosteds.id', 'PostAssessments.id', 'Boosteds->Boosters.id', 'Boosteds->Targets.id']
  })
  console.timeEnd('fetching-post-boosts');

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


module.exports = router;
