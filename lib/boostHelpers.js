var Sequelize = require('sequelize');
var db  = require('../models');
var constants = require('../lib/constants');
const logger = require('../lib/logger');
const Op = Sequelize.Op;

async function getBoostersandCredSources(req) {

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
      req.headers.usernames.split(',').forEach( src =>{
        source_promises.push(db.Source.findOne({where: {userName: src}}));
      });
      cred_sources = (await Promise.all(source_promises)).map(source => {return source.id});
    }
   }
  else //unmuted followeds
    cred_sources = unmuted_boosters_ids.concat(auth_user_.id);

  return [unmuted_boosters_ids, cred_sources];
}

function buildBoostQuery(req, boosters_ids, cred_sources) {

  logger.info("unmuted_boosters_ids " + boosters_ids)
  logger.info("cred sources " + cred_sources)

  //validity status
  let min_range, max_range;
  if (req.headers.validity == constants.VALIDITY_TYPES.CONFIRMED) {
    min_range = [1, 2];
    max_range = [2];
  }
  else if (req.headers.validity == constants.VALIDITY_TYPES.REFUTED) {

    min_range =[0];
    max_range = [0, 1];
  }
  else if (req.headers.validity == constants.VALIDITY_TYPES.DEBATED) {
    min_range = [0];
    max_range = [2];
  }
  else { //all
    min_range = [0, 1, 2];
    max_range = [0, 1, 2];
  }


  let auth_user_id = [req.user.id]

  let raw_sql = 'SELECT DISTINCT(`Post`.`id`) FROM `Posts` AS `Post` \
  LEFT OUTER JOIN `Boosts` AS `PostBoosts` ON `Post`.`id` = `PostBoosts`.`PostId` \
  LEFT OUTER JOIN ( `TargetBoosts` AS `PostBoosts->Targets->TargetBoosts` \
  INNER JOIN `Sources` AS `PostBoosts->Targets` ON `PostBoosts->Targets`.`id` = `PostBoosts->Targets->TargetBoosts`.`SourceId`) \
  ON `PostBoosts`.`id` = `PostBoosts->Targets->TargetBoosts`.`BoostId` \
  INNER JOIN `Assessments` AS `PostAssessments` ON `Post`.`id` = `PostAssessments`.`PostId` \
  AND `PostAssessments`.`SourceId` IN :cred_sources AND `PostAssessments`.`version` = 1'

  if (req.headers.validity == constants.VALIDITY_TYPES.QUESTIONED) {

    raw_sql += ' AND `PostAssessments`.`postCredibility` = 1'
   //TODO: change
  }

  let extra_where = false;
  if (req.headers.seenstatus == constants.SEEN_STATUS.SEEN) {
    raw_sql += ' INNER JOIN ( `PostSeers` AS `Seers->PostSeers` INNER JOIN `Sources` AS `Seers` ON `Seers`.`id` = `Seers->PostSeers`.`SourceId`) \
    ON `Post`.`id` = `Seers->PostSeers`.`PostId` AND `Seers`.`id` IN :auth_user_id'
  }
  else if (req.headers.seenstatus == constants.SEEN_STATUS.NOTSEEN) {

    raw_sql += ' LEFT OUTER JOIN ( `PostSeers` AS `Seers->PostSeers` INNER JOIN `Sources` AS `Seers` ON `Seers`.`id` = `Seers->PostSeers`.`SourceId`) \
    ON `Post`.`id` = `Seers->PostSeers`.`PostId`'
    extra_where = true;
  }
  else {
    //all - no join
  }

  if (extra_where) {
    raw_sql += ' WHERE ((`Seers`.`id` NOT IN :auth_user_id OR `Seers`.`id` is NULL ) AND \
    (`PostBoosts`.`SourceId` IN :auth_user_id OR (`PostBoosts`.`SourceId` IN :boosters_ids AND \
    (`PostBoosts->Targets`.`id` IS NULL OR `PostBoosts->Targets`.`id` IN :auth_user_id))))'
  }
  else {
    raw_sql += ' WHERE (`PostBoosts`.`SourceId` IN :auth_user_id OR (`PostBoosts`.`SourceId` IN :boosters_ids AND \
    (`PostBoosts->Targets`.`id` IS NULL OR `PostBoosts->Targets`.`id` IN :auth_user_id)))'
  }

  raw_sql += ' GROUP BY `Post`.`id` \
  HAVING (max(`PostAssessments`.`postCredibility`) IN :max_range AND min(`PostAssessments`.`postCredibility`) IN :min_range) \
  ORDER BY `Post`.`updatedAt` DESC LIMIT :offset, :limit;'

  let replacements = {
    auth_user_id: [auth_user_id] ,
    cred_sources: [cred_sources],
    boosters_ids: [boosters_ids],
    offset: req.query.offset ? parseInt(req.query.offset) : 0,
    limit: req.query.limit ? parseInt(req.query.limit) : 10,
    max_range: [max_range],
    min_range: [min_range]
  }

  return [raw_sql, replacements];
}

async function buildActivityQuery(req, post_id) {

  let user = await db.Source.findOne(
    {where: {userName: req.params.username}
  });

  let raw_sql = 'SELECT DISTINCT(`Post`.`id`) FROM `Posts` AS `Post` \
   LEFT OUTER JOIN `Boosts` AS `PostBoosts` ON `Post`.`id` = `PostBoosts`.`PostId` \
   LEFT OUTER JOIN ( `TargetBoosts` AS `PostBoosts->Targets->TargetBoosts` \
  INNER JOIN `Sources` AS `PostBoosts->Targets` ON `PostBoosts->Targets`.`id` = `PostBoosts->Targets->TargetBoosts`.`SourceId`) \
  ON `PostBoosts`.`id` = `PostBoosts->Targets->TargetBoosts`.`BoostId` \
  LEFT OUTER JOIN `Assessments` AS `PostAssessments` ON `Post`.`id` = `PostAssessments`.`PostId` AND `PostAssessments`.`version` = 1 \
  WHERE (`PostBoosts`.`SourceId` IN :auth_user_id OR (`PostAssessments`.`SourceId` IN :auth_user_id AND `PostAssessments`.`isTransitive` = false)) \
  GROUP BY `Post`.`id` \
  ORDER BY `Post`.`updatedAt` DESC LIMIT :offset, :limit;'

  let auth_user_id = [user.id]

  let replacements = {
    auth_user_id: [auth_user_id] ,
    offset: req.query.offset ? parseInt(req.query.offset) : 0,
    limit: req.query.limit ? parseInt(req.query.limit) : 10
  }

  return [raw_sql, replacements];
}


async function getPostBoosts(post_ids, req, boosters_ids, cred_sources) {

  let post_where_clause = {
    [Op.and]: [{
      id: {
        [Op.in]: post_ids
      }
    }, {
      [Op.or]: [
      {
        //for posts that the auth user has boosted
        '$PostBoosts.SourceId$': {
          [Op.in]: [req.user.id]
        }
      },
      {
      //for posts that others have posted
      [Op.and] : [
        {
          '$PostBoosts.SourceId$': {
            [Op.or]: {
              [Op.eq]: Sequelize.col('Post.SourceId'),
              [Op.in]: boosters_ids
            }
          }
        },
        {
          '$PostBoosts->Targets.id$': {
            [Op.or]: {
              [Op.eq]: null,
              [Op.in]: [req.user.id]
            }
          }
        }]
      }]
    }]

  }

  let query = {
    include: [
      {
        model: db.Boost,
        as: 'PostBoosts',
        include: [
          {
            model: db.Source,
            as: 'Targets',
            through: {
              attributes: []
            }
          }
        ]
      },

      {
        model: db.Assessment,
        as: 'PostAssessments',
        where: {
          SourceId: {
            [Op.in]: cred_sources
          }
        }
      }
  ],
    where: post_where_clause
  };

  let post_boosts = await db.Post.findAll({
    ...query,
    order: [
      [ 'updatedAt', 'DESC'],
      [ 'PostAssessments', 'SourceId', 'DESC'],
      [ 'PostAssessments', 'version', 'DESC']
    ],
    group: ['Post.id', 'PostBoosts.id', 'PostAssessments.id', 'PostBoosts->Targets.id']
  });

  return post_boosts;
}


module.exports = {
  getBoostersandCredSources,
  buildBoostQuery,
  getPostBoosts,
  buildActivityQuery
}
