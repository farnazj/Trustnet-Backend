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

  //let paginationReq = routeHelpers.getLimitOffset(req);
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
.post(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  let assessments = await db.Assessment.findAll({
    where: {
      [Op.and]: [{
        SourceId: req.user.id
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
    isTransitive: false,
    sourceIsAnonymous: typeof req.body.sourceIsAnonymous !== 'undefined' ?
      req.body.sourceIsAnonymous : false
  };

  if (assessments.length) {
    for (let assessment of assessments)
        assessment.update({ version: assessment.version - 1 });
  }

  let authUserProm = db.Source.findByPk(req.user.id);
  let postProm = db.Post.findByPk(req.params.post_id);
  let assessmentProm = db.Assessment.create(assessmentSpecs);
  let reasonProms = req.body.reasons.map(reason => {
    db.AssessmentReason.create(reason)
  })

  let [post, authUser, assessment, reasons] = await Promise.all([postProm, authUserProm, assessmentProm, ...reasonProms]);

  assessment.addReasons(reasons);
  let sourceAssessment = authUser.addSourceAssessment(assessment);
  let postAssessment = post.addPostAssessment(assessment);

  let assessmentArbitersProm, arbiters;

  if (req.body.arbiters) {
    arbiters = await db.Source.findAll({
      where: {
        userName: {
          [Op.in]: req.body.arbiters
        }
      }
    });

    assessmentArbitersProm = assessment.addArbiters(arbiters);
  }

  routeHelpers.markPostAsUnseenAfterAssessment(post, authUser.id);


  if (assessment.postCredibility == constants.VALIDITY_CODES.QUESTIONED)
      notificationHelpers.notifyAboutQuestion(assessment, authUser, post, arbiters);
  else {
      db.Source.findAll({
        where: {
          '$Trusteds.id$': {
            [Op.in]: [req.user.id]
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
              SourceId: {
                [Op.in]: trusters.map(el => el.id)
              }
            }, {
              postCredibility: 0
            }, {
              version: 1
            }]
              
          }
        }).then(prevPosedQuestions => {
          if (prevPosedQuestions.length)
            notificationHelpers.notifyAboutAnswer(assessment, authUser, post, trusters, prevPosedQuestions);
        })
      })
  }

  await Promise.all([sourceAssessment, postAssessment, assessmentArbitersProm]);

  // queue.create('newAssessmentPosted', {postId: req.params.post_id, sourceId: req.user.id})
  // .priority('medium').removeOnComplete(true).save();

  res.send({ message: 'Assessment posted' });
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
