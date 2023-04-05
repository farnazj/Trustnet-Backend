var express = require('express');
var router = express.Router();
var db  = require('../models');
var routeHelpers = require('../lib/routeHelpers');
var boostHelpers = require('../lib/boostHelpers');
var urlRedirectHelpers = require('../lib/urlRedirectHelpers');
var wrapAsync = require('../lib/wrappers').wrapAsync;
var Sequelize = require('sequelize');
const constants = require('../lib/constants');
var util = require('../lib/util');
const got = require('got');
const Op = Sequelize.Op;
const parse = require('node-html-parser').parse;
var moment = require('moment');
// var kue = require('kue')
//  , queue = kue.createQueue();

router.route('/posts/:post_id/assessments')
.get(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  let relations = await boostHelpers.getBoostersandCredSources(req);

  let post = await db.Post.findOne({
    where: { id: req.params.post_id },
    include: [
      {
        model: db.Assessment,
        as: 'PostAssessments',
        where: {
          SourceId: {
            [Op.in] : relations.followedTrusteds
          }
        }
      }
    ]
  });

  res.send(post.PostAssessments);
}))

//post or update assessment
.post(wrapAsync(async function(req, res) {


  if (typeof req.user === 'undefined' && typeof req.body.assessorToken === 'undefined') {
    res.status(403).send({ message: 'User not recognized' });
  }
  else {

    let authUser;

    //for external sources that send an identifying token with their request
    if (req.body.assessorToken) {
      let token = await db.Token.findOne({
        where: {
          tokenStr: req.body.assessorToken,
          tokenType: constants.TOKEN_TYPES.OUTSIDE_SOURCE_ASSESSMENT
        },
        include: [{
          model: db.Source
        }]
      });
    
      if (!token) {
        res.status(403).send({ message: 'Source not recognized.' })
      }
      else {
        authUser = token.Source;
      }
    }
    else { //for sources that are signed up on the platform
      authUser = await db.Source.findByPk(req.user.id);
    }

    let post = await db.Post.findByPk(req.params.post_id);

    await routeHelpers.postOrUpdateAssessments({
      post: post,
      authUser: authUser,
      req: req
    })

    // queue.create('newAssessmentPosted', {postId: req.params.post_id, sourceId: req.user.id})
    // .priority('medium').removeOnComplete(true).save();
  
    res.send({ message: 'Assessment posted' });
  }

}));


router.route('/posts/:post_id/:user_id/assessment')

.get(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  let assessments = await db.Assessment.findAll({
    where: {
      SourceId: req.params.user_id,
      PostId: req.params.post_id
    },
    order: [
      [ 'version', 'DESC'],
    ]
  });

  res.send(assessments);
}));

/*
headers: {
  url: stringified array -- urls of the posts the user is requesting assessments for,
  authuser: id of the authUser (Optional)
  excludeposter: boolean indicating whether the assessments from the initiator of the
  post should be excluded
  usernames: usernames of specified assessors
}
*/
router.route('/posts/assessments/urls')
.get(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  let urls = JSON.parse(req.headers.urls);

  let assessors = [];
  if (req.headers.authuser)
    assessors = [req.user.id]
  else if (req.headers.usernames) {
    assessors = (await db.Source.findAll({
      attributes: ['id'],
      where: {
        userName: {
          [Op.in]: JSON.parse(req.headers.usernames)
        }
      }
    })).map(el => el.id);
  }
  else {
    assessors = (await boostHelpers.getBoostersandCredSources(req)).followedTrusteds;
  }

  let extendedUrls = util.constructAltURLs(urls);

  let whereConfig;

  if (req.headers.excludeposter && req.headers.excludeposter == 'true') {
    whereConfig =  {
      [Op.and]: [{
        url: {
          [Op.in]: extendedUrls
        }
      }, {
        [Op.or]: [{
          SourceId: null
        }, {
          '$PostAssessments.SourceId$': {
            [Op.ne]: Sequelize.col('Post.SourceId')
          }
        }]
        
      } 
      ]
    }
  }
  else {
    whereConfig = {
      url: {
        [Op.in]: extendedUrls
      }
    }
  }

  let posts = await db.Post.findAll({
    where: whereConfig,
    include: [
      {
        model: db.Assessment,
        as: 'PostAssessments',
        where: {
          SourceId: {
            [Op.in] : assessors
          }
        }
      }
    ]
  });
  
  let returnedPosts = boostHelpers.anonymizeAnonymousQuestions(posts.filter(post => post), req.user.id);

  res.send(returnedPosts);
}));


/*
headers: {
  url: stringified array -- urls of the posts the user is requesting assessments for
}
*/
router.route('/posts/unfollowed-assessors/urls')
.get(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  let urls = JSON.parse(req.headers.urls);
  let extendedUrls = util.constructAltURLs(urls)
  let followedAndTrusteds = (await boostHelpers.getBoostersandCredSources(req)).followedTrusteds;

  let posts = await db.Post.findAll({
 
    where: {
      [Op.and]: [{
        url: {
          [Op.in]: extendedUrls
        }
      }, {
        '$PostAssessments.SourceId$': {
          [Op.notIn]: followedAndTrusteds,
          
          [Op.or]: [{
            [Op.eq]: null
          }, {
            [Op.ne]: Sequelize.col('Post.SourceId')
          }]
          
          
        }
      }, {
        //Either the assessor has posted an assessment or has asked a question with no specified arbiter
        [Op.or]: [{
          '$PostAssessments.postCredibility$': {
            [Op.ne]: 0
          }
        }, {
          '$PostAssessments->Arbiters.id$': {
            [Op.eq]: null
          }
        }]
      }]
    },
    include: [
      {
        model: db.Assessment,
        as: 'PostAssessments',
        where: {
          version: 1
        },
        include: [{
          model: db.Source,
          as: 'Arbiters',
          through: {
            attributes: []
          },
          required: false
        }]
      }
    ]
  });

  let returnedPosts = boostHelpers.anonymizeAnonymousQuestions(posts.filter(post => post), req.user.id);

  if (returnedPosts.length) {
    let assessorSourceIds = returnedPosts.map(post => post.PostAssessments.map(assessment => assessment.SourceId)).flat();

    let queryStr = 'SELECT `Source`.`id`, `Source`.`systemMade`, `Source`.`firstName`, `Source`.`lastName`, \
     `Source`.`userName`, `Source`.`email`, `Source`.`description`, `Source`.`photoUrl`, \
     `Source`.`isVerified` FROM `Sources` AS `Source` LEFT OUTER JOIN \
     ( `SourceTrusteds` AS `Trusteds->SourceTrusteds` INNER JOIN `Sources` AS `Trusteds` \
     ON `Trusteds`.`id` = `Trusteds->SourceTrusteds`.`SourceId`) \
     ON `Source`.`id` = `Trusteds->SourceTrusteds`.`TrustedId` \
     WHERE `Source`.`id` IN :unfollowed_assessors GROUP BY `Source`.`id` ORDER BY COUNT(`Source`.`id`) DESC LIMIT :limit;';
  
    let replacements = {
      unfollowed_assessors: [assessorSourceIds],
      limit: 10
    }
  
    let orderedAssessors = await db.sequelize.query(queryStr,
      { replacements: replacements, type: Sequelize.QueryTypes.SELECT });
  
    res.send(orderedAssessors);
  }
  else {
    res.send([]);
  }

  
}));


router.route('/posts/assessments/url')
/*
posting an assessment
expects req.body of the form:
{
  url: String
  body: String,
  postCredibility: Number,
  sourceIsAnonymous (optional): Boolean,
  sourceArbiters (optional): Array of Strings
  emailArbiters (optional): Array of Strings
}
*/
.post(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  await routeHelpers.importPost(req.body.url);
  let post = await db.Post.findOne({
    where: { url: util.extractHostname(req.body.url) }
  });  

  console.log('post chi shod', post)
  
  let authUser = await db.Source.findByPk(req.user.id);

  await routeHelpers.postOrUpdateAssessments({
    post: post,
    authUser: authUser,
    req: req
  });

  res.send({ message: 'Assessment posted' });

}));

/*
questions about the accuracy of a set of urls
*/
router.route('/posts/questions/urls')
.get(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  let questionPosers;

  if (req.headers.usernames) {
    questionPosers = (await db.Source.findAll({
      attributes: ['id'],
      where: {
        userName: {
          [Op.in]: JSON.parse(req.headers.usernames)
        }
      }
    })).map(el => el.id);
  }
  else {
    let relations = await boostHelpers.getBoostersandCredSources(req)
    let followedAndTrusteds = relations.followedTrusteds;
    let trusters = relations.trusters.concat(req.user.id);
    questionPosers = followedAndTrusteds.concat(trusters);
  }


  let urls = JSON.parse(req.headers.urls);
  let extendedUrls = util.constructAltURLs(urls);

  let posts = await db.Post.findAll({
    where: {
        /*
        Questions (assessments of type question) that have either specified the auth
        user as an arbiter or have specified no arbiter and [have either marked the auth user
        as a trusted source (the SourceId of the question is the id of someone who is 
        among the trusters of the auth user) or are among the people the auth user follows
        or trusts]
        */
        [Op.and]: [ {
          url: {
            [Op.in]: extendedUrls
          }
        }, {
          '$PostAssessments.postCredibility$': constants.ACCURACY_CODES.QUESTIONED
        }, {
          '$PostAssessments.version$': 1
        },
        {
          [Op.or]: [{
            '$PostAssessments->Arbiters.id$': req.user.id
          }, {
            [Op.and]: [ {
              '$PostAssessments->Arbiters.id$': {
                [Op.eq]: null
              }
            }, {
              '$PostAssessments.SourceId$': {
                [Op.in]: questionPosers
              }
            }]

          }]
        }]
    },
    include: [
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
      }
    ]
  });

  let returnedPosts = boostHelpers.anonymizeAnonymousQuestions(posts.filter(post => post), req.user.id)
  res.send(returnedPosts);
}));


/*
Follow the urls and get the urls where they redirect to
*/
router.route('/urls/follow-redirects')
.get(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {
  let urlMapping = await urlRedirectHelpers.followLinkMappings(JSON.parse(req.headers.urls), 2000, 1);
  urlRedirectHelpers.storeURLMappings(urlMapping);
  res.send(urlMapping);
}));


router.route('/urls/schedule-redirects')
.post(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  let initialLinks = Object.keys(req.body.urlMappings);
  setTimeout(() => {
    console.log('scheduled fetching of redirects is about to start');
    let urlMapping = urlRedirectHelpers.followLinkMappings(initialLinks, 2000, 2);
    let urlsFailed = initialLinks.filter(x => !Object.values(urlMapping).includes(x));

    let clientMappingsForFailedURLs = {};
    Object.entries(req.body.urlMappings).forEach(([key, val]) => {
      if (urlsFailed.includes(key))
        clientMappingsForFailedURLs[key] = val;
    })

    console.log('mappings that the server has received from the client and wants to store', clientMappingsForFailedURLs);
    urlRedirectHelpers.storeURLMappings(clientMappingsForFailedURLs);

  }, 20000)

  res.send({ message: 'fetching redirects scheduled' });

}));


router.route('/urls/redirects')
.get(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {
  
  let originURLs = JSON.parse(req.headers.urls);
  let mappings = await urlMappingsRedisHandler.getURLMapping(originURLs);
  let originURLsInDB = originURLs.filter((url, index) => 
    mappings[index]
  );

  if (originURLsInDB.length) {
    let currentTime = moment();

    db.URLRedirection.update({
      lastAccessTime: currentTime
    }, {
      where: {
        originURL: {
          [Op.in]: originURLsInDB
        }
      }
    })
  }

  console.log('mappings', mappings)
  res.send(mappings);
})) 

.post(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  let urlMappings = JSON.parse(req.body.urlMappings);
  console.log('what is the client sending for storage', urlMappings)
  urlRedirectHelpers.storeURLMappings(urlMappings);
  res.send({ message: 'URL mappings updated' })

}));


module.exports = router;
