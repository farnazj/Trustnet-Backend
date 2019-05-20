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

  let unmuted_followeds = auth_user_.Follows.filter(source =>
    (!auth_user_.Mutes.map(muted_source => {return muted_source.id}).includes(source.id) ));
  let unmuted_followeds_ids = unmuted_followeds.map(booster => {return booster.id});

  let trusted_ids = auth_user_.Trusteds.map(source => {return source.id});

  //crediblity criteria
  let cred_sources;
  let req_source = req.headers.source ? req.headers.source.toLowerCase() : undefined;

  if (req_source == constants.CRED_SOURCES.TRUSTED)
    cred_sources = trusted_ids;
  else if (req_source == constants.CRED_SOURCES.ME)
    cred_sources = [auth_user_.id];
  else if (req_source == constants.CRED_SOURCES.USERNAMES) //as is, you can check anyone's opinion, doesn't need to be followed or trusted by you
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
    cred_sources = unmuted_followeds_ids;

  let followed_trusted_ids = Array.from(new Set(unmuted_followeds_ids.concat(trusted_ids).concat(auth_user_.id)));
  return [unmuted_followeds_ids, cred_sources, followed_trusted_ids];
}

function buildBoostQuery(req, boosters_ids, cred_sources) {

  logger.info("unmuted_boosters_ids " + boosters_ids)
  logger.info("cred sources " + cred_sources)

  let auth_user_id = [req.user.id]
  let req_validity = req.headers.validity ? req.headers.validity.toLowerCase() : undefined;

  let raw_sql = 'SELECT DISTINCT(`Post`.`id`) FROM `Posts` AS `Post` \
  LEFT OUTER JOIN `Boosts` AS `PostBoosts` ON `Post`.`id` = `PostBoosts`.`PostId` \
  LEFT OUTER JOIN ( `TargetBoosts` AS `PostBoosts->Targets->TargetBoosts` \
  INNER JOIN `Sources` AS `PostBoosts->Targets` ON `PostBoosts->Targets`.`id` = `PostBoosts->Targets->TargetBoosts`.`SourceId`) \
  ON `PostBoosts`.`id` = `PostBoosts->Targets->TargetBoosts`.`BoostId` \
  INNER JOIN `Assessments` AS `PostAssessments` ON `Post`.`id` = `PostAssessments`.`PostId` \
  AND `PostAssessments`.`SourceId` IN :cred_sources AND `PostAssessments`.`version` = 1'

  if (req_validity == constants.VALIDITY_TYPES.QUESTIONED) {
    raw_sql += ' AND `PostAssessments`.`postCredibility` = 0'
  }

  let extra_where = false;
  let req_seen_status = req.headers.seenstatus ? req.headers.seenstatus.toLowerCase() : undefined;

  if (req_seen_status == constants.SEEN_STATUS.SEEN) {
    raw_sql += ' INNER JOIN ( `PostSeers` AS `Seers->PostSeers` INNER JOIN `Sources` AS `Seers` ON `Seers`.`id` = `Seers->PostSeers`.`SourceId`) \
    ON `Post`.`id` = `Seers->PostSeers`.`PostId` AND `Seers`.`id` IN :auth_user_id'
  }
  else if (req_seen_status == constants.SEEN_STATUS.NOTSEEN) {

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

  raw_sql += ' GROUP BY `Post`.`id`'

  if (req_validity == constants.VALIDITY_TYPES.CONFIRMED) {
    raw_sql += ' HAVING (max(`PostAssessments`.`postCredibility`) > :max_validity_threshold \
      AND min(`PostAssessments`.`postCredibility`) >= :neutral_validity_threshold )'
  }
  else if (req_validity == constants.VALIDITY_TYPES.REFUTED) {
    raw_sql += ' HAVING (max(`PostAssessments`.`postCredibility`) <= :neutral_validity_threshold \
      AND min(`PostAssessments`.`postCredibility`) < :min_validity_threshold )'
  }
  else if (req_validity == constants.VALIDITY_TYPES.DEBATED) {
    raw_sql += ' HAVING (max(`PostAssessments`.`postCredibility`) > :max_validity_threshold \
      AND min(`PostAssessments`.`postCredibility`) < :min_validity_threshold )'
  }

  raw_sql += ' ORDER BY `Post`.`updatedAt` DESC LIMIT :offset, :limit;'

  let replacements = {
    auth_user_id: [auth_user_id] ,
    cred_sources: [cred_sources],
    boosters_ids: [boosters_ids],
    offset: req.query.offset ? parseInt(req.query.offset) : 0,
    limit: req.query.limit ? parseInt(req.query.limit) : 10,
    max_validity_threshold: constants.VALIDITY_CODES.QUESTIONED,
    neutral_validity_threshold: constants.VALIDITY_CODES.QUESTIONED,
    min_validity_threshold: constants.VALIDITY_CODES.QUESTIONED
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


async function getPostBoosts(post_ids, req, boosters_ids, followed_trusted_ids) {

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
            [Op.in]: followed_trusted_ids
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
