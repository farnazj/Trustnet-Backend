var express = require('express');
var router = express.Router();
var db  = require('../models');
var routeHelpers = require('../lib/routeHelpers');
var notificationHelpers = require('../lib/notificationHelpers');
var wrapAsync = require('../lib/wrappers').wrapAsync;
var Sequelize = require('sequelize');
const constants = require('../lib/constants');
const Op = Sequelize.Op;

// var kue = require('kue')
//  , queue = kue.createQueue();

router.route('/posts/:post_id/assessments')
//TODO: need to change this if some posts become private
.get(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  let post = await db.Post.findOne({
    where: { id: req.params.post_id },
    include: [
      {
        model: db.Assessment,
        as: 'PostAssessments',
        include: [{
          model: db.AssessmentReason,
          as: 'Reasons'
        }]
      }
    ],
    order: [
      ['PostAssessments', 'Reasons', 'Code', 'ASC' ]
    ]
  });

  res.send(post.PostAssessments);
}))


/* 
post new or update existing assessment
expects req.body of the form:
{
  postCredibility: Boolean
  sourceIsAnonymous (optional): Boolean
  reasons: Array of Objects of the type { body: String, code: Number }
}
*/

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

    //find older assessments by the user for the post and decrement their version number
    //so that the newly posted assessment can have a version of 1 (the most recent version)
    let assessments = await db.Assessment.findAll({
      where: {
        [Op.and]: [{
          SourceId: authUser.id
        },  {
          PostId: req.params.post_id
        }]
        
      },
      order: [
        [ 'version', 'DESC'],
      ]
    });
  
    let assessmentSpecs = {
      postCredibility: req.body.postCredibility,
      body: req.body.body,
      isTransitive: false,
      sourceIsAnonymous: typeof req.body.sourceIsAnonymous !== 'undefined' ?
        req.body.sourceIsAnonymous : false
    };
  
    if (assessments.length) {
      for (let assessment of assessments)
          assessment.update({ version: assessment.version - 1 });
    }
  
    let postProm = db.Post.findByPk(req.params.post_id);
    let assessmentProm = db.Assessment.create(assessmentSpecs);
  
    let [post, assessment] = await Promise.all([postProm, assessmentProm]);
  
    let sourceAssessment = authUser.addSourceAssessment(assessment);
    let postAssessment = post.addPostAssessment(assessment);
  
    let assessmentArbitersProm, registeredArbiters, outsideSources;
  
    if (req.body.sourceArbiters || req.body.emailArbiters) {
      registeredArbiters = await db.Source.findAll({
        where: {
          [Op.and]: [{
            isVerified: true
          }, {
            [Op.or]: [{
              userName: {
                [Op.in]: req.body.sourceArbiters
              }
            }, {
              email: {
                [Op.in]: req.body.emailArbiters
              }
            }]
          }]
        }
      });
  
      let sourceEmails = registeredArbiters.map(arbiter => arbiter.email);
      let emailsNotRegistered = req.body.emailArbiters.filter(email => !sourceEmails.includes(email));
      outsideSources = await routeHelpers.makeOrFindAccountOnBehalf(emailsNotRegistered);
  
      assessmentArbitersProm = assessment.addArbiters(registeredArbiters.concat(outsideSources));
    }
  
    routeHelpers.markPostAsUnseenAfterAssessment(post, authUser.id);
  
  
    if (assessment.postCredibility == 0)
        notificationHelpers.notifyAndEmailAboutQuestion(assessment, authUser, post, registeredArbiters.concat(outsideSources));
    else {
        db.Source.findAll({
          where: {
            '$Trusteds.id$': {
              [Op.in]: [authUser.id]
            }
          },
          include: [{
            model: db.Source,
            as: 'Trusteds'
          }]
        })
        .then(trusters => {
          db.Assessment.findAll({
            where: {
              [Op.and]: [{
                PostId: req.params.post_id
              }, {
                postCredibility: 0
              }, {
                version: 1
              },
              {
                [Op.or]: [{
                  SourceId: {
                    [Op.in]: trusters.map(el => el.id)
                  }
                }, {
                  '$Arbiters.id$': authUser.id
                }]
              }
            ]
            },
            include: [{
              model: db.Source,
              as: 'Arbiters',
              required: false
            }]
          }).then(prevPosedQuestions => {
            if (prevPosedQuestions.length) {
              notificationHelpers.notifyAndEmailAboutAnswer(assessment, authUser, post, trusters, prevPosedQuestions);
            }
              
          })
        })
    }
  
    await Promise.all([sourceAssessment, postAssessment, assessmentArbitersProm]);
  
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
    include: [{
      model: db.AssessmentReason,
      as: 'Reasons'
    }],
    order: [
      [ 'version', 'DESC'],
      [ 'Reasons', 'Code', 'ASC' ]
    ]
  });

  res.send(assessments);
}));


router.route('/reason-codes')
.get(wrapAsync(async function(req, res) {
  res.send(constants.REASON_CODES_ENUM);
}));

module.exports = router;
