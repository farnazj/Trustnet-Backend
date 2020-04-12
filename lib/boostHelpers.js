var Sequelize = require('sequelize');
var db  = require('../models');
var constants = require('../lib/constants');
const logger = require('../lib/logger');
const Op = Sequelize.Op;

async function getBoostersandCredSources(req) {

  let authUser = await db.Source.findOne({
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

  let unmutedFolloweds = authUser.Follows.filter(source =>
    (!authUser.Mutes.map(mutedSource => {return mutedSource.id}).includes(source.id) ));
  let unmutedFollowedIds = unmutedFolloweds.map(booster => {return booster.id});
  unmutedFollowedIds = unmutedFollowedIds.concat(authUser.id);

  let trustedIds = authUser.Trusteds.map(source => {return source.id});

  //crediblity criteria
  let credSources;
  let reqSource = req.headers.source ? req.headers.source.toLowerCase() : undefined;

  if (reqSource == constants.CRED_SOURCES.TRUSTED)
    credSources = trustedIds;
  else if (reqSource == constants.CRED_SOURCES.ME)
    credSources = [authUser.id];
  else if (reqSource == constants.CRED_SOURCES.SPECIFIED)
   {
    let sourcePromises = [];
    let individualSources = [];
    let listSources = [];

    credSources = [];

    if (req.headers.usernames) {

      JSON.parse(req.headers.usernames).forEach( src => {
        sourcePromises.push(db.Source.findOne({
          where: {
            userName: src
          }
        }));
      });
      individualSources = (await Promise.all(sourcePromises)).map(source => {return source.id});
    }

    if (req.headers.lists) {

      let lists = await db.SourceList.findAll({
        where: {
          SourceId: req.user.id,
          id: {
            [Op.in]: JSON.parse(req.headers.lists)
          }
        },
        include: [{
          model: db.Source,
          as: 'ListEntities',
          attributes: ['id'],
          through: {
            attributes: []
          }
        }]
      });

      listSources = [].concat.apply([], lists.map(el => el.ListEntities)).map(source => source.id);
    }
    credSources = Array.from(new Set(listSources.concat(individualSources)));
  }
  else if (reqSource == constants.CRED_SOURCES.FOLLOWED)//unmuted followeds
    credSources = unmutedFollowedIds;

  //if req.source doesn't exist, CRED_SOURCES is undefined

  let followedTrustedIds = Array.from(new Set(unmutedFollowedIds.concat(trustedIds).concat(authUser.id)));
  return [unmutedFollowedIds, credSources, followedTrustedIds];
}

function buildBoostQuery(req, boostersIds, credSources, exploreMode) {

  let authUserId = [req.user.id];
  let reqValidity = req.headers.validity ? req.headers.validity.toLowerCase() : undefined;

  let rawSql = 'SELECT DISTINCT(`Post`.`id`) FROM `Posts` AS `Post` \
  LEFT OUTER JOIN `Boosts` AS `PostBoosts` ON `Post`.`id` = `PostBoosts`.`PostId` \
  LEFT OUTER JOIN ( `TargetBoosts` AS `PostBoosts->Targets->TargetBoosts` \
  INNER JOIN `Sources` AS `PostBoosts->Targets` ON `PostBoosts->Targets`.`id` = `PostBoosts->Targets->TargetBoosts`.`SourceId`) \
  ON `PostBoosts`.`id` = `PostBoosts->Targets->TargetBoosts`.`BoostId` \
  INNER JOIN `Assessments` AS `PostAssessments` ON `Post`.`id` = `PostAssessments`.`PostId` \
 AND `PostAssessments`.`version` = 1'

 if (credSources)
  rawSql += ' AND `PostAssessments`.`SourceId` IN :cred_sources';


  if (reqValidity == constants.VALIDITY_TYPES.QUESTIONED) {
    rawSql += ' AND `PostAssessments`.`postCredibility` = 0'
  }

  let notSeenWhere = false;
  let reqSeenStatus = req.headers.seenstatus ? req.headers.seenstatus.toLowerCase() : undefined;
  let reqTags = req.headers.tags && JSON.parse(req.headers.tags).length ?
    JSON.parse(req.headers.tags) : undefined;


  if (reqSeenStatus == constants.SEEN_STATUS.SEEN) {
    rawSql += ' INNER JOIN ( `PostSeers` AS `Seers->PostSeers` INNER JOIN `Sources` AS `Seers` ON `Seers`.`id` = `Seers->PostSeers`.`SourceId`) \
    ON `Post`.`id` = `Seers->PostSeers`.`PostId` AND `Seers`.`id` IN :auth_user_id'
  }
  else if (reqSeenStatus == constants.SEEN_STATUS.NOTSEEN) {

    rawSql += ' LEFT OUTER JOIN ( `PostSeers` AS `Seers->PostSeers` INNER JOIN `Sources` AS `Seers` ON `Seers`.`id` = `Seers->PostSeers`.`SourceId`) \
    ON `Post`.`id` = `Seers->PostSeers`.`PostId`'
    notSeenWhere = true;
  }
  else {
    //all - no join
  }

  if (reqTags) {
    rawSql += ' LEFT OUTER JOIN (`PostTags` INNER JOIN `Tags` ON `PostTags`.`TagId` = `Tags`.`id`)\
     on `Post`.`id`= `PostTags`.`PostId`';
  }

  rawSql += ' WHERE ';

  if (notSeenWhere || reqTags) {
    rawSql += '(';

    if (notSeenWhere)
      rawSql += '(`Seers`.`id` NOT IN :auth_user_id OR `Seers`.`id` is NULL ) AND '

    if (reqTags)
      rawSql += '(`Tags`.`id` IN :tag_ids) AND ';
  }


  rawSql += '(`PostBoosts`.`SourceId` IN :auth_user_id OR ';

  if (!exploreMode)
    rawSql += '(`PostBoosts`.`SourceId` IN :boosters_ids AND ';

  rawSql += '(`PostBoosts->Targets`.`id` IS NULL OR `PostBoosts->Targets`.`id` IN :auth_user_id))';

  if (!exploreMode)
    rawSql += ')';


  if (notSeenWhere || reqTags)
    rawSql += ')';

  rawSql += ' GROUP BY `Post`.`id`'

  if (reqValidity == constants.VALIDITY_TYPES.CONFIRMED) {
    rawSql += ' HAVING (max(`PostAssessments`.`postCredibility`) > :max_validity_threshold \
      AND min(`PostAssessments`.`postCredibility`) >= :neutral_validity_threshold )'
  }
  else if (reqValidity == constants.VALIDITY_TYPES.REFUTED) {
    rawSql += ' HAVING (max(`PostAssessments`.`postCredibility`) <= :neutral_validity_threshold \
      AND min(`PostAssessments`.`postCredibility`) < :min_validity_threshold )'
  }
  else if (reqValidity == constants.VALIDITY_TYPES.DEBATED) {
    rawSql += ' HAVING (max(`PostAssessments`.`postCredibility`) > :max_validity_threshold \
      AND min(`PostAssessments`.`postCredibility`) < :min_validity_threshold )'
  }

  rawSql += ' ORDER BY `Post`.`publishedDate` DESC LIMIT :offset, :limit;'

  let replacements = {
    auth_user_id: [authUserId] ,
    cred_sources: [credSources],
    boosters_ids: [boostersIds],
    tag_ids: [reqTags],
    offset: req.query.offset ? parseInt(req.query.offset) : 0,
    limit: req.query.limit ? parseInt(req.query.limit) : 10,
    max_validity_threshold: constants.VALIDITY_CODES.QUESTIONED,
    neutral_validity_threshold: constants.VALIDITY_CODES.QUESTIONED,
    min_validity_threshold: constants.VALIDITY_CODES.QUESTIONED
  }

  return [rawSql, replacements];
}

async function buildActivityQuery(req, activityUser) {

  let reqTags = req.headers.tags && JSON.parse(req.headers.tags).length ?
    JSON.parse(req.headers.tags) : undefined;

  let rawSql = 'SELECT DISTINCT(`Post`.`id`) FROM `Posts` AS `Post` \
  LEFT OUTER JOIN `Boosts` AS `PostBoosts` ON `Post`.`id` = `PostBoosts`.`PostId` \
  LEFT OUTER JOIN ( `TargetBoosts` AS `PostBoosts->Targets->TargetBoosts` \
  INNER JOIN `Sources` AS `PostBoosts->Targets` ON `PostBoosts->Targets`.`id` = `PostBoosts->Targets->TargetBoosts`.`SourceId`) \
  ON `PostBoosts`.`id` = `PostBoosts->Targets->TargetBoosts`.`BoostId` \
  LEFT OUTER JOIN `Assessments` AS `PostAssessments` ON `Post`.`id` = `PostAssessments`.`PostId` AND `PostAssessments`.`version` = 1';

  if (reqTags)
    rawSql += ' LEFT OUTER JOIN (`PostTags` INNER JOIN `Tags` ON `PostTags`.`TagId` = `Tags`.`id`) \
    on `Post`.`id`= `PostTags`.`PostId`';

  rawSql += ' WHERE '
  if (reqTags)
    rawSql += '((`Tags`.`id` IN :tag_ids) AND ';

  rawSql += '(`PostBoosts`.`SourceId` IN :user_id OR \
    (`PostAssessments`.`SourceId` IN :user_id AND `PostAssessments`.`isTransitive` = false))';

  if (reqTags)
      rawSql += ')';

  rawSql += 'GROUP BY `Post`.`id` \
  ORDER BY `Post`.`publishedDate` DESC LIMIT :offset, :limit;'

  let userId = [activityUser.id];

  let replacements = {
    user_id: [userId],
    tag_ids: [reqTags],
    offset: req.query.offset ? parseInt(req.query.offset) : 0,
    limit: req.query.limit ? parseInt(req.query.limit) : 10
  }

  return [rawSql, replacements];
}


async function getPostBoosts(postIds, req, boostersIds, assessorsIds, exploreMode) {

  let boostsConfig;

  if (exploreMode) { //from any booster
    boostsConfig =  {
      '$PostBoosts->Targets.id$': {
        [Op.or]: {
          [Op.eq]: null,
          [Op.in]: [req.user.id]
        }
      }
    }
  }
  else { //from specific boosters
    boostsConfig = {
     [Op.or]: [
     {
       //for posts that the auth user has boosted
       '$PostBoosts.SourceId$': {
         [Op.in]: [req.user.id]
       }
     },
     {
     //for posts that others have boosted
     [Op.and] : [
       {
         '$PostBoosts.SourceId$': {
           [Op.or]: {
             [Op.eq]: Sequelize.col('Post.SourceId'),
             [Op.in]: boostersIds
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
   }
  }

  let postWhereClause;

  if (assessorsIds) {
    postWhereClause = {
     [Op.and]: [{
       id: {
         [Op.in]: postIds
       }
     },
     boostsConfig,
     {
       '$PostAssessments.SourceId$': {
         [Op.or]: {
           [Op.eq]: Sequelize.col('Post.SourceId'),
           [Op.in]: assessorsIds
         }
       }
     }
     ]}
  }
  else {
    postWhereClause = {
     [Op.and]: [{
       id: {
         [Op.in]: postIds
       }
     },
     boostsConfig
   ]}
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
        as: 'PostAssessments'
      },
      {
        model: db.CustomTitle,
        as: 'PostCustomTitles',
        where: {
          SourceId: {
            [Op.in]: boostersIds.concat(Sequelize.col('Post.SourceId'))
          }
        },
        required: false
      },
      {
        model: db.Tag,
        through: {
          attributes: []
        },
        required: false
      }
  ],
    where: postWhereClause
  };

  let postBoosts = await db.Post.findAll({
    ...query,
    order: [
      [ 'publishedDate', 'DESC'],
      [ 'PostAssessments', 'SourceId', 'DESC'],
      [ 'PostAssessments', 'version', 'DESC'],
    ],
    group: ['Post.id', 'PostBoosts.id', 'PostAssessments.id', 'PostBoosts->Targets.id', 'PostCustomTitles.id', 'Tags.id', 'Tags->PostTags.createdAt',
    'Tags->PostTags.updatedAt', 'Tags->PostTags.TagId', 'Tags->PostTags.PostId']
  });

  return postBoosts;
}


module.exports = {
  getBoostersandCredSources,
  buildBoostQuery,
  getPostBoosts,
  buildActivityQuery
}
