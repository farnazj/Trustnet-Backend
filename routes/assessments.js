var express = require('express');
var router = express.Router();
var db  = require('../models');
var routeHelpers = require('../lib/routeHelpers');
var boostHelpers = require('../lib/boostHelpers');
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

}))


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
}
*/
router.route('/posts/assessments/urls')
.get(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  let urls = JSON.parse(req.headers.urls);

  let assessors = [];
  if (req.headers.authuser)
    assessors = [req.user.id]
  else {
    assessors = (await boostHelpers.getBoostersandCredSources(req)).followedTrusteds;
  }

  let whereConfig;

  if (req.headers.excludeposter && req.headers.excludeposter == 'true') {
    whereConfig =  {
      [Op.and]: [{
        url: {
          [Op.in]: urls
        }
      }, {
        '$PostAssessments.SourceId$': {
          [Op.ne]: Sequelize.col('Post.SourceId')
        }
      }]
    }
  }
  else {
    whereConfig = {
      url: {
        [Op.in]: urls
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

  let returnedPosts = boostHelpers.anonymizeAnonymousQuestions(posts.filter(post => post), req.user.id)
  res.send(returnedPosts);
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

  let trusters = (await boostHelpers.getBoostersandCredSources(req)).trusters.concat(req.user.id);

  let posts = await db.Post.findAll({
    where: {
        /*
        Questions (assessments of type question) that have either specified the auth
        user as an arbiter or have specified no arbiter and have marked the auth user
        as a trusted source (the SourceId of the question is the id of someone who is 
        among the trusters of the auth user)
        */
        [Op.and]: [ {
          url: {
            [Op.in]: JSON.parse(req.headers.urls)
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
                [Op.in]: trusters
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

  let gotProms = [];
  let urlMapping = {};

  JSON.parse(req.headers.urls).forEach(sentUrl => {

    gotProms.push(
      got(sentUrl, {
      timeout: 2000,
      retry: 1,
      followRedirect: true
      })
      .then((response) => {

        let targetUrl;
        try {
          let dom = parse(response.body);
          let meta = dom.querySelector('meta[property="og:url"]');
          targetUrl = meta.getAttribute('content')
        }
        catch(err) {
          targetUrl = response.url;
        }
        urlMapping[util.extractHostname(targetUrl)] = sentUrl;

      })
      .catch((err) => {
        console.log('fetching sentUrl encounterd an error', sentUrl, err)
      })
    )
    
  })

  await Promise.allSettled(gotProms);

  let transformedURLMappings = [];
  let currentTime = moment();

  Object.entries(urlMapping).forEach(([key, val]) => {
    transformedURLMappings.push({ originURL: key, targetURL: val });
    db.URLRedirection.create({
      originURL: key,
      targetURL: val,
      lastAccessTime: currentTime
    })
  });

  urlMappingsRedisHandler.addMappings(transformedURLMappings);

  res.send(urlMapping);
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

  res.send(mappings);
}))

.post(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  let urlMappings = JSON.parse(req.body.urlMappings);
  let transformedURLMappings = [];
  let currentTime = moment();

  Object.entries(urlMappings).forEach(([key, val]) => {
    transformedURLMappings.push({ originURL: key, targetURL: val});
    db.URLRedirection.create({
      originURL: key,
      targetURL: val,
      lastAccessTime: currentTime
    })
  });

  if (transformedURLMappings.length)
    await urlMappingsRedisHandler.addMappings(transformedURLMappings);
  
  res.send({ message: 'URL mappings updated' })

}));




module.exports = router;
