var Sequelize = require('sequelize');
var db  = require('../models');
var constants = require('../lib/constants');
const logger = require('../lib/logger');
var moment = require('moment');
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
  let credSources = [];
  let reqAssessors = req.headers.sources && JSON.parse(req.headers.sources).length ? 
    JSON.parse(req.headers.sources).map(assessor => assessor.toLowerCase()) : [];

  if (reqAssessors.includes(constants.CRED_SOURCES.TRUSTED))
    credSources.push(...trustedIds);
  if (reqAssessors.includes(constants.CRED_SOURCES.ME))
    credSources.push(authUser.id);
  if (reqAssessors.includes(constants.CRED_SOURCES.SPECIFIED))
   {
    let sourcePromises = [];
    let individualSources = [];
    let listSources = [];

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
    credSources.push(...Array.from(new Set(listSources.concat(individualSources))));
  }
  if (reqAssessors.includes(constants.CRED_SOURCES.FOLLOWED))//unmuted followeds
    credSources.push(...unmutedFollowedIds);
  // else if (reqSource == constants.CRED_SOURCES.ANYONE)
  //   credSources = followedTrustedIds;
  //if req.source doesn't exist, CRED_SOURCES is an empty array

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
  let titleContributors = relations.followedTrusteds.concat(req.user.id);
  let authUserId = [req.user.id];
  let reqValidity = req.headers.validity ? req.headers.validity.toLowerCase() : undefined;

  let rawSql = 'SELECT DISTINCT(`Post`.`id`), MAX(`PostBoosts`.`createdAt`), \
  ( \
    SELECT COUNT(*) \
    FROM `Boosts` \
    WHERE `Post`.`id` = `Boosts`.`PostId` AND `Boosts`.`createdAt` >= :oldest_boost_time\
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
  `PostAssessments->Arbiters->AssessmentArbiters`.`SourceId` IN :auth_user_id \
  LEFT OUTER JOIN `CustomTitles` AS `PostCustomTitles` ON `PostCustomTitles`.`PostId` = `Post`.`id` AND `PostCustomTitles`.`SourceId` IN :title_contributors ';


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

  if (credSources.length)
    rawSql += '(`PostAssessments`.`SourceId` IN :cred_sources AND ';

  rawSql += '(`PostBoosts`.`SourceId` IN :auth_user_id OR ';

  if (!exploreMode)
    rawSql += '(`PostBoosts`.`SourceId` IN :boosters_ids AND ';

  rawSql += '(`PostBoosts->Targets`.`id` IS NULL OR `PostBoosts->Targets`.`id` IN :auth_user_id)) \
    OR `PostCustomTitles`.`id` IS NOT NULL ';

  if (!exploreMode)
    rawSql += ')';

  if (credSources.length)
    rawSql += ')';

  //if ([constants.VALIDITY_TYPES.QUESTIONED, constants.VALIDITY_TYPES.ALL].includes(reqValidity) ) {
  if ([constants.VALIDITY_TYPES.ALL].includes(reqValidity) ) {

    rawSql += ' OR (`PostAssessments`.`postCredibility` = 0 AND (';

    //if (trusters.length)
    //  rawSql+= ' `PostAssessments`.`SourceId` IN :trusters OR ' ;
    if (credSources.length) {
      rawSql+= ' `PostAssessments`.`SourceId` IN :cred_sources OR '
    }

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

  rawSql += ' ORDER BY Boost_Count_Custom DESC, MAX(`PostBoosts`.`createdAt`) DESC, `Post`.`publishedDate` DESC LIMIT :offset, :limit;'

  let replacements = {
    auth_user_id: [authUserId] ,
    cred_sources: [credSources],
    boosters_ids: [boostersIds],
    trusters: [trusters],
    title_contributors: [titleContributors],
    tag_ids: [reqTags],
    offset: req.query.offset ? parseInt(req.query.offset) : 0,
    limit: req.query.limit ? parseInt(req.query.limit) : 10,
    max_validity_threshold: constants.VALIDITY_CODES.QUESTIONED,
    neutral_validity_threshold: constants.VALIDITY_CODES.QUESTIONED,
    min_validity_threshold: constants.VALIDITY_CODES.QUESTIONED,
    oldest_boost_time: moment().subtract(21, 'days').format()
  }

  return [rawSql, replacements];
}

async function buildActivityQuery(req, activityUser, authUserId) {

  let reqTags = req.headers.tags && JSON.parse(req.headers.tags).length ?
    JSON.parse(req.headers.tags) : undefined;

  let rawSql = 'SELECT DISTINCT(`Post`.`id`), MAX(`PostAssessments`.`updatedAt`), MAX(`PostBoosts`.`createdAt`) \
  FROM `Posts` AS `Post` \
  LEFT OUTER JOIN `Boosts` AS `PostBoosts` ON `Post`.`id` = `PostBoosts`.`PostId` \
  LEFT OUTER JOIN ( `TargetBoosts` AS `PostBoosts->Targets->TargetBoosts` \
  INNER JOIN `Sources` AS `PostBoosts->Targets` ON `PostBoosts->Targets`.`id` = `PostBoosts->Targets->TargetBoosts`.`SourceId`) \
  ON `PostBoosts`.`id` = `PostBoosts->Targets->TargetBoosts`.`BoostId` \
  LEFT OUTER JOIN `Assessments` AS `PostAssessments` ON `Post`.`id` = `PostAssessments`.`PostId` AND `PostAssessments`.`version` = 1 \
  LEFT OUTER JOIN `CustomTitles` AS `PostCustomTitles` ON `PostCustomTitles`.`PostId` = `Post`.`id` AND `PostCustomTitles`.`SourceId` IN :user_id ';

  if (reqTags)
    rawSql += ' LEFT OUTER JOIN (`PostTags` INNER JOIN `Tags` ON `PostTags`.`TagId` = `Tags`.`id`) \
    on `Post`.`id`= `PostTags`.`PostId`';

  rawSql += ' WHERE '
  if (reqTags)
    rawSql += '((`Tags`.`id` IN :tag_ids) AND ';

  rawSql += '(`PostBoosts`.`SourceId` IN :user_id OR \
    `PostCustomTitles`.`id` IS NOT NULL  OR \
    (`PostAssessments`.`SourceId` IN :user_id AND (`PostAssessments`.`isTransitive` = false';

  if (activityUser.id != authUserId)
    rawSql += ' AND ( `PostAssessments`.`postCredibility` != 0 \
       OR (`PostAssessments`.`sourceIsAnonymous` = false OR `PostAssessments`.`sourceIsAnonymous` is NULL)) ' ;

  rawSql += ')))';


  if (reqTags)
      rawSql += ')';

  rawSql += ' GROUP BY `Post`.`id` \
  ORDER BY MAX(`PostAssessments`.`updatedAt`) DESC, MAX(`PostBoosts`.`createdAt`) DESC, `Post`.`publishedDate` DESC LIMIT :offset, :limit;'

  let replacements = {
    user_id: [[activityUser.id]],
    tag_ids: [reqTags],
    offset: req.query.offset ? parseInt(req.query.offset) : 0,
    limit: req.query.limit ? parseInt(req.query.limit) : 10
  }

  return [rawSql, replacements];
}

//posts that are displayed on the homepage
function buildBoostWhereClause(postIds, req, relations, exploreMode) {

  let boostersIds = relations.boosters;
  let assessorsIds = !exploreMode ? relations.followedTrusteds : undefined;
  let trustersIds = relations.trusters;
  
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
  else { //from specific boosters (user's unmuted followed sources)
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
          /*
          any assessments from the auth user
          */
          '$PostAssessments.SourceId$': {
            [Op.eq]: req.user.id
          }
        },
        {
          /*
          non-question assessments from the initiator of posts
          */
          // [Op.and]: [ 
          //  {
           '$PostAssessments.SourceId$': {
             [Op.or]: {
               [Op.eq]: Sequelize.col('Post.SourceId'),
               [Op.in]: assessorsIds
             }
           }
          
          // , {
          //  '$PostAssessments.postCredibility$': {
          //    [Op.ne]: constants.VALIDITY_CODES.QUESTIONED
          //  }
          // }
        
        },
        {  /*
          questions from those who trust the auth user or 
          those who specifically have asked the auth user
         */
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

  return postWhereClause;

}

//posts that are displayed when visiting a source's profile
function buildActivityWhereClause(postIds, req, relations, activityUser) {
  
  let activityUserId = activityUser.id;

  let boostersIds = relations.boosters;
  let assessorsIds = relations.followedTrusteds;
  let trustersIds = relations.trusters;
  let customTitlePosters = relations.boosters.concat([activityUserId]);


  let boostsConfig = {

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
              [Op.in]: boostersIds.concat(activityUserId)
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

  let postWhereClause = {
    [Op.and]: [{
      id: {
        [Op.in]: postIds
      }
    },
    boostsConfig,
    {
      [Op.or]: [
        {
          /*
          any assessments from the auth user
          */
          '$PostAssessments.SourceId$': {
            [Op.eq]: req.user.id
          }
        },
        {
          /*
          non-question assessments from the initiator of posts or owner of the profile
          */
          [Op.and]: [ 
          {
          '$PostAssessments.SourceId$': {
            [Op.or]: {
              [Op.eq]: Sequelize.col('Post.SourceId'),
              [Op.in]: assessorsIds.concat([activityUserId])
            }
          }
          }, {
          '$PostAssessments.postCredibility$': {
            [Op.ne]: constants.VALIDITY_CODES.QUESTIONED
          }
          }]
        
        },
        {  /*non-anonymous questions from the owner of the profile, 
        those who trust the auth user or those who specifically have asked the auth user
        */
          [Op.and]: [
            {
              '$PostAssessments.postCredibility$': {
                [Op.eq]: constants.VALIDITY_CODES.QUESTIONED
              }
            },
            {
              '$PostAssessments.sourceIsAnonymous$': {
                [Op.or]: [{
                  [Op.eq]: null
                },
                {
                  [Op.eq]: false
                }]
              }
            },
            {
              [Op.or]: [
              {
                '$PostAssessments.SourceId$': {
                  [Op.in]: trustersIds.concat(activityUserId)
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
            }
          ]
        }, 
        {
          '$PostCustomTitles.SourceId$': {
            
            [Op.or]: [{
              [Op.in]: customTitlePosters
            }, {
              [Op.eq]: Sequelize.col('Post.SourceId')
            }]
            
          }
        }
      ]
    }
  ]}
 
  return postWhereClause;
}


async function getPostBoosts(postIds, req, relations, exploreMode, activityUser) {

  let postWhereClause, queryAttributes, orderStatements;
  if (!activityUser) {

    postWhereClause = buildBoostWhereClause(postIds, req, relations, exploreMode);
    queryAttributes = { 
      include: [
        [Sequelize.fn("MAX", Sequelize.col("PostBoosts.createdAt")), "Most_Recent_Boost_Time"],
        [Sequelize.fn("COUNT", Sequelize.col("PostBoosts.id")), "Boost_Count_Custom"]
      ]
    }

    orderStatements = [
      [ Sequelize.literal('Boost_Count_Custom DESC')],
      [ Sequelize.literal('Most_Recent_Boost_Time DESC')]
    ]
  }
  else {
    postWhereClause = buildActivityWhereClause(postIds, req, relations, activityUser)
    queryAttributes = {
      include: [
        [Sequelize.fn("MAX", Sequelize.col("PostBoosts.createdAt")), "Most_Recent_Boost_Time"],
        [Sequelize.fn("MAX", Sequelize.col("PostAssessments.updatedAt")), "Most_Recent_Assessment_Time"]
      ]
    }

    orderStatements = [
      [ Sequelize.literal('Most_Recent_Assessment_Time DESC')],
      [ Sequelize.literal('Most_Recent_Boost_Time DESC')]
    ]
  }
    

  let customTitlePosters = relations.followedTrusteds;
  if (activityUser)
    customTitlePosters = customTitlePosters.concat(activityUser.id);

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
            [Op.or]: [{
              [Op.in]: customTitlePosters
            }, {
              [Op.eq]: Sequelize.col('Post.SourceId')
            }]
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
    attributes: queryAttributes,
    ...query,
    order: [
      ...orderStatements,
      [ 'publishedDate', 'DESC'],
      [ 'PostAssessments', 'SourceId', 'DESC'],
      [ 'PostAssessments', 'version', 'DESC']
    ],
    group: ['Post.id', 'PostBoosts.id', 'PostAssessments.id', 'PostAssessments->Arbiters.id',
    'PostBoosts->Targets.id', 'PostCustomTitles.id', 'Tags.id', 'Tags->PostTags.createdAt',
    'Tags->PostTags.updatedAt', 'Tags->PostTags.TagId', 'Tags->PostTags.PostId',
    'PostAssessments->Arbiters->AssessmentArbiters.createdAt', 'PostAssessments->Arbiters->AssessmentArbiters.updatedAt',
    'PostAssessments->Arbiters->AssessmentArbiters.AssessmentId', 'PostAssessments->Arbiters->AssessmentArbiters.sourceId'
  ]
  });

  let sanitizedPosts = anonymizeAnonymousQuestions(postBoosts, req.user.id);

  return sanitizedPosts;
}


function anonymizeAnonymousQuestions(posts, authUserId) {

  posts.forEach(post => {
    let assessments = post.PostAssessments.map(assessment => {
      if (assessment.SourceId != authUserId && assessment.postCredibility == constants.VALIDITY_CODES.QUESTIONED) {
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
