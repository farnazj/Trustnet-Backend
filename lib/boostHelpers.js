var Sequelize = require('sequelize');
var db  = require('../models');
var constants = require('../lib/constants');
const logger = require('../lib/logger');
const Op = Sequelize.Op;

async function buildQuery(req, post_id) {
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

  let unmuted_boosters = auth_user_.Follows.filter(source =>
    (!auth_user_.Mutes.map(muted_source => {return muted_source.id}).includes(source.id) ));
  let unmuted_boosters_ids = unmuted_boosters.map(booster => {return booster.id});

  //crediblity criteria
  let cred_sources;
  if (req.headers.source == constants.CRED_SOURCES.TRUSTED)
    cred_sources = auth_user_.Trusteds.map(source => {return source.id});
  else if (req.headers.source == constants.CRED_SOURCES.ME)
    cred_sources = [auth_user_.id];
  else if (req.headers.source == constants.CRED_SOURCES.USERNAMES) //as is, you can check anyone's opinion, doesn't need to be followed or trusted by you
   {
    let source_promises = [];
    if (!req.headers.usernames)
        cred_sources = [];
    else {
      req.headers.usernames.split(',').map( src =>{
        source_promises.push(db.Source.findOne({where: {userName: src}}));
      });
      cred_sources = (await Promise.all(source_promises)).map(source => {return source.id});
    }
   }
  else
    cred_sources = unmuted_boosters_ids.concat(auth_user_.id);

  logger.info("unmuted_boosters_ids " + unmuted_boosters_ids)
  logger.info("cred sources " + cred_sources)


  //validity status
  /* temporarily replaced by boostPatch
  let having_statement;
  if (req.headers.validity == constants.VALIDITY_TYPES.CONFIRMED) {
    having_statement = {
      [Op.and] : {
        '$minValidity$': {
            [Op.in] : [1, 2] },
        '$maxValidity$': {
            [Op.eq] : 2}
      }
    }
  }
  else if (req.headers.validity == constants.VALIDITY_TYPES.REFUTED) {
    having_statement = {
      [Op.and] : {
        '$minValidity$': {
            [Op.eq] : 0},
        '$maxValidity$': {
            [Op.in] : [0, 1]}
      }
    }
  }
  else if (req.headers.validity == constants.VALIDITY_TYPES.DEBATED) {
    having_statement = {
      [Op.and] : {
        '$minValidity$': {
            [Op.eq] : 0},
        '$maxValidity$': {
            [Op.eq] : 2}
      }
    }
  }
  else { //all
    having_statement = {}
  }
  */

  let common_where_clause = {
    [Op.or]: [{

      //for posts that the auth user has boosted
      [Op.and] : [{
        '$Boosteds.SourceId$': {
          [Op.in]: [req.user.id]
        }
      },
      {
        '$PostAssessments.SourceId$': {
          [Op.in]: cred_sources
        }
      }]
    },
    {
    //for posts that others have posted
    [Op.and] : [{
        '$PostAssessments.SourceId$': {
          [Op.in]: cred_sources
        }
      },
      {
        '$Boosteds.SourceId$': {
          [Op.in]: unmuted_boosters_ids
        }
      },
      {
        '$Boosteds->Targets.id$': {
          [Op.or]: {
            [Op.eq]: null,
            [Op.in]: [req.user.id]
          }
        }
      }]
    }]
  }


  let temp_where_statement;
  if (post_id) {
    temp_where_statement = {
      [Op.and] : [{
        id: post_id,
      },
      common_where_clause
      ]
    }
  }
  else {
    temp_where_statement = common_where_clause;
  }


  let where_statement;
  if (req.headers.validity == constants.VALIDITY_TYPES.QUESTIONED) {
    where_statement = {
      [Op.and] : [{
        '$PostAssessments.postCredibility$': {
          [Op.in]: [1]
        }
      },
      temp_where_statement
      ]
    }
  }
  else {
    where_statement = temp_where_statement;
  }


  if(req.headers.seenstatus == constants.SEEN_STATUS.SEEN) {
    where_statement = {
      [Op.and] : [{
        '$Seers.id$': {
          [Op.in]: [req.user.id]
        }
      },
      where_statement
      ]
    }
  }
  else if (req.headers.seenstatus == constants.SEEN_STATUS.NOTSEEN) {
    where_statement = {
      [Op.and] : [{
        '$Seers.id$': {
          [Op.or]: {
            [Op.eq]: null,
            [Op.notIn]: [req.user.id]
          }
        }
      },
      where_statement
      ]
    }
  }


  let query = {
    subQuery: false,
    // attributes: {
    //     include: [
    //       [Sequelize.fn('MIN', Sequelize.col('PostAssessments.postCredibility')), `minValidity`],
    //       [Sequelize.fn('MAX', Sequelize.col('PostAssessments.postCredibility')), `maxValidity`]
    //     ]
    //    },
    include: [
      {
        model: db.Boost,
        as: 'Boosteds',
        include: [
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
        required: true
      },
      {
        model: db.Source,
        as: 'Seers',
        attributes: [],
        through: {
          attributes: []
        }
      }
    ],
    where: where_statement,
    //having: having_statement //replaced with boostPatch
  };

  return query;

}

async function buildActivityQuery(username, post_id) {

  let user = await db.Source.findOne(
    {where: {userName: username}
  });

  let common_where_clause = {
    [Op.or]: [{
      '$Boosteds.SourceId$': {
        [Op.in]: [user.id]
      }
    },
    {
      [Op.and]: [{
        '$PostAssessments.SourceId$': {
          [Op.in]: [user.id]
        }
      },
      {
        '$PostAssessments.isTransitive$': {
          [Op.eq]: false
        }
      }]

    }]
  };


  let where_statement;
  if (post_id) {
    where_statement = {
      [Op.and] : [{
        id: post_id,
      },
      common_where_clause
      ]
    }
  }
  else {
    where_statement = common_where_clause;
  }

  let query = {
    subQuery: false,
    include: [
      {
        model: db.Boost,
        as: 'Boosteds',
        include: [
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
        as: 'PostAssessments'
      }
    ],
    where: where_statement
  };

  return query;
}


async function getPostBoosts(post_ids) {

  let query = {
    subQuery: false,
    include: [
      {
        model: db.Boost,
        as: 'Boosteds',
        include: [
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
      }
    ],
    where: {
      id: {
        [Op.in]: post_ids
      }
    }
  };

  let post_boosts = await db.Post.findAll({
    ...query,
    order: [
      [ 'updatedAt', 'DESC'],
      [ 'PostAssessments', 'updatedAt', 'DESC'],
    ],
    group: ['Post.id', 'Boosteds.id', 'PostAssessments.id', 'Boosteds->Targets.id']
  });

  return post_boosts;
}

function sliceResults(req, results) {
  let limit = req.query.limit ? parseInt(req.query.limit) : 15;
  let offset= req.query.offset ? parseInt(req.query.offset) : 0;
  let slice = results.slice(offset, offset + limit);
  return slice;
}

module.exports = {
  buildQuery,
  getPostBoosts,
  buildActivityQuery,
  sliceResults
}
