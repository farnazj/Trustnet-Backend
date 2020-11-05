var Sequelize = require('sequelize');
var db  = require('../models');
var constants = require('../lib/constants');
const logger = require('../lib/logger');
const Op = Sequelize.Op;

async function getBoostersandCredSources(req) {

  let trustersProm = db.Source.findAll({
    where: {
      '$Trusteds.id$': {
        [Op.in]: [req.user.id]
      }
    },
    include: [{
      model: db.Source,
      as: 'Trusteds'
    }]
  });

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
  let followedTrustedIds = Array.from(new Set(unmutedFollowedIds.concat(trustedIds).concat(authUser.id)));

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
  else if (reqSource == constants.CRED_SOURCES.ANYONE)
    credSources = followedTrustedIds;
  //if req.source doesn't exist, CRED_SOURCES is undefined

  let trusters = await trustersProm;
  let trustersIds = trusters.map(truster => truster.id);

  return {
    boosters: unmutedFollowedIds,
    credSources: credSources,
    followedTrusteds: followedTrustedIds,
    trusters: trustersIds
  };
}

function buildBoostQuery(req, relations, exploreMode) {

  let boostersIds = relations.boosters;
  let credSources = relations.credSources;
  let trusters = relations.trusters;
  let authUserId = [req.user.id];
  let reqValidity = req.headers.validity ? req.headers.validity.toLowerCase() : undefined;

  let rawSql = 'SELECT DISTINCT(`Post`.`id`), \
  ( \
    SELECT COUNT(*) \
    FROM `Boosts` \
    WHERE `Post`.`id` = `Boosts`.`PostId` \
  ) AS `Boost_Count_Custom` \
  FROM `Posts` AS `Post` \
  LEFT OUTER JOIN `Boosts` AS `PostBoosts` ON `Post`.`id` = `PostBoosts`.`PostId` \
  LEFT OUTER JOIN ( `TargetBoosts` AS `PostBoosts->Targets->TargetBoosts` \
  INNER JOIN `Sources` AS `PostBoosts->Targets` ON `PostBoosts->Targets`.`id` = `PostBoosts->Targets->TargetBoosts`.`SourceId`) \
  ON `PostBoosts`.`id` = `PostBoosts->Targets->TargetBoosts`.`BoostId` \
  INNER JOIN `Assessments` AS `PostAssessments` ON `Post`.`id` = `PostAssessments`.`PostId` \
  AND `PostAssessments`.`version` = 1 LEFT OUTER JOIN ( `PostSeers` AS `Seers->PostSeers` INNER JOIN `Sources` AS \
  `Seers` ON `Seers`.`id` = `Seers->PostSeers`.`SourceId`) \
  ON `Post`.`id` = `Seers->PostSeers`.`PostId` AND (`Seers->PostSeers`.`SourceId` = :auth_user_id OR  `Seers->PostSeers`.`SourceId` is NULL) \
  LEFT OUTER JOIN ( `AssessmentArbiters` AS `PostAssessments->Arbiters->AssessmentArbiters` \
  INNER JOIN `Sources` AS `AssessmentArbiters->Arbiters` ON \
  `AssessmentArbiters->Arbiters`.`id` = `PostAssessments->Arbiters->AssessmentArbiters`.`SourceId`)\
  ON `PostAssessments`.`id` = `PostAssessments->Arbiters->AssessmentArbiters`.`AssessmentId` AND \
  `PostAssessments->Arbiters->AssessmentArbiters`.`SourceId` IN :auth_user_id';


  let notSeenWhere = false;
  let reqSeenStatus = req.headers.seenstatus ? req.headers.seenstatus.toLowerCase() : undefined;
  let reqTags = req.headers.tags && JSON.parse(req.headers.tags).length ?
    JSON.parse(req.headers.tags) : undefined;

  if (reqTags) {
    rawSql += ' LEFT OUTER JOIN (`PostTags` INNER JOIN `Tags` ON `PostTags`.`TagId` = `Tags`.`id`)\
     on `Post`.`id`= `PostTags`.`PostId`';
  }

  rawSql += ' WHERE ';

  if (reqSeenStatus == constants.SEEN_STATUS.SEEN)
    rawSql += '`Seers`.`id` IN :auth_user_id AND ';

  if (reqSeenStatus == constants.SEEN_STATUS.NOTSEEN)
    rawSql += '`Seers`.`id` IS NULL AND ';

  if (reqTags)
    rawSql += '`Tags`.`id` IN :tag_ids AND ';


  if (reqValidity == constants.VALIDITY_TYPES.QUESTIONED) {
    rawSql += '`PostAssessments`.`postCredibility` = 0 AND '
  }

  rawSql += '(';

  if (credSources)
    rawSql += '(`PostAssessments`.`SourceId` IN :cred_sources AND ';

  rawSql += '(`PostBoosts`.`SourceId` IN :auth_user_id OR ';

  if (!exploreMode)
    rawSql += '(`PostBoosts`.`SourceId` IN :boosters_ids AND ';

  rawSql += '(`PostBoosts->Targets`.`id` IS NULL OR `PostBoosts->Targets`.`id` IN :auth_user_id))';

  if (!exploreMode)
    rawSql += ')';

  if (credSources)
    rawSql += ')';

  if ([constants.VALIDITY_TYPES.QUESTIONED, constants.VALIDITY_TYPES.ALL].includes(reqValidity) ) {

    rawSql += ' OR (`PostAssessments`.`postCredibility` = 0 AND (';

    if (trusters.length)
      rawSql+= ' `PostAssessments`.`SourceId` IN :trusters OR ' ;

    rawSql += '`PostAssessments->Arbiters->AssessmentArbiters`.`SourceId` IN :auth_user_id ))';

  }

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

  rawSql += ' ORDER BY Boost_Count_Custom DESC, `Post`.`publishedDate` DESC LIMIT :offset, :limit;'

  let replacements = {
    auth_user_id: [authUserId] ,
    cred_sources: [credSources],
    boosters_ids: [boostersIds],
    trusters: [trusters],
    tag_ids: [reqTags],
    offset: req.query.offset ? parseInt(req.query.offset) : 0,
    limit: req.query.limit ? parseInt(req.query.limit) : 10,
    max_validity_threshold: constants.VALIDITY_CODES.QUESTIONED,
    neutral_validity_threshold: constants.VALIDITY_CODES.QUESTIONED,
    min_validity_threshold: constants.VALIDITY_CODES.QUESTIONED
  }

  return [rawSql, replacements];
}

async function buildActivityQuery(req, activityUser, authUserId) {

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
    (`PostAssessments`.`SourceId` IN :user_id AND (`PostAssessments`.`isTransitive` = false';

  if (activityUser.id != authUserId)
  rawSql += ' AND `PostAssessments`.`sourceIsAnonymous` = false';

  rawSql += ')))';


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


async function getPostBoosts(postIds, req, relations, exploreMode, activityQuery) {

  let boostersIds = relations.boosters;
  let assessorsIds = !exploreMode ? relations.followedTrusteds : undefined;
  let trustersIds = relations.trusters;
  if (activityQuery) {
    assessorsIds = assessorsIds.concat(req.user.id);
    boostersIds = boostersIds.concat(req.user.id);
  }

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
       [Op.or]: [
         {
           '$PostAssessments.SourceId$': {
             [Op.or]: {
               [Op.eq]: Sequelize.col('Post.SourceId'),
               [Op.in]: assessorsIds
             }
           }
         },
         {
           [Op.and]: [
             {
              '$PostAssessments.postCredibility$': {
                [Op.eq]: constants.VALIDITY_CODES.QUESTIONED
              }
            },
            {
              [Op.or]: [
                {
                '$PostAssessments.SourceId$': {
                  [Op.in]: trustersIds
                }
              },
              {
               '$PostAssessments->Arbiters.id$': {
                 [Op.or]: {
                   [Op.eq]: null,
                   [Op.in]: [req.user.id]
                 }
               }
             }]
            }]
         }
        ]
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
        as: 'PostAssessments',
        include: [{
          model: db.Source,
          as: 'Arbiters',
          through: {
            attributes: []
          },
          required: false
        }]
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
    // attributes: { 
    //   include: [[Sequelize.fn("COUNT", Sequelize.col("PostBoosts.id")), "Boost_Count_Custom"]],
    // },
    ...query,
    order: [
      [ 'publishedDate', 'DESC'],
      [ 'PostAssessments', 'SourceId', 'DESC'],
      [ 'PostAssessments', 'version', 'DESC'],
    ],
    group: ['Post.id', 'PostBoosts.id', 'PostAssessments.id', 'PostAssessments->Arbiters.id',
    'PostBoosts->Targets.id', 'PostCustomTitles.id', 'Tags.id', 'Tags->PostTags.createdAt',
    'Tags->PostTags.updatedAt', 'Tags->PostTags.TagId', 'Tags->PostTags.PostId',
    'PostAssessments->Arbiters->AssessmentArbiters.createdAt', 'PostAssessments->Arbiters->AssessmentArbiters.updatedAt',
    'PostAssessments->Arbiters->AssessmentArbiters.AssessmentId', 'PostAssessments->Arbiters->AssessmentArbiters.sourceId'
  ]
  });

  let sanitizedPosts = anonymizeTrustersQuestions(postBoosts, relations);

  return sanitizedPosts;
}


function anonymizeTrustersQuestions(posts, relations) {

  posts.forEach(post => {
    let assessments = post.PostAssessments.map(assessment => {
      if (!relations.followedTrusteds.includes(assessment.SourceId)) {
        if (assessment.sourceIsAnonymous == true)
          assessment.SourceId = null;
      }
      if (assessment.SourceId === null && assessment.version != 1)
        return null;
      else
        return assessment;
    })

    posts.PostAssessments = assessments.filter(assessment => assessment !== null);
  });

  return posts;
}

module.exports = {
  getBoostersandCredSources,
  buildBoostQuery,
  getPostBoosts,
  buildActivityQuery
}
