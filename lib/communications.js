var Sequelize = require('sequelize');
var db  = require('../models');
var constants = require('../lib/constants');
const logger = require('../lib/logger');
var transporter = require('../lib/transporter');
var crypto = require('crypto');
require('dotenv').config();


async function notifyBoostTargets(targets, source, postId) {

  let sender = source.firstName + ' ' + source.lastName;
  let postLink = constants.CLIENT_BASE_URL + '/posts/' + postId;

  for (let target of targets) {

    const shareNotifMailOptions = {
      from: process.env.EMAIL_USER,
      to: target.email,
      subject:  `${sender} shared an article with you on ${constants.SITE_NAME}`,
      html: `<p>Hi ${target.firstName}!</p>
      <p> ${sender} shared an article with you on ${constants.SITE_NAME}.</p>
      <p> Click <a href="${postLink}">here</a> to view the article.</p>
      <br>
      <p>-The ${constants.SITE_NAME} team</p>`
    };

    transporter.sendMail(shareNotifMailOptions, function (err, info) {
       if(err)
         logger.error(err);
       else
         logger.info(info);
    });
  }

}


async function notifyInquirers(assessment, questionAskers, assessor, post) {

  let assessorName = assessor.firstName ? (assessor.firstName + ' ' + assessor.lastName) : assessor.email;
  let postLink = constants.CLIENT_BASE_URL + '/posts/' + post.id;
  let responseText = assessment.body ? `<p style="font-style:italic;">&ldquo;${assessment.body}&rdquo;</p> <br>` : '';
  let postCredibility = assessment.postCredibility != constants.ACCURACY_CODES.QUESTIONED ?
    (assessment.postCredibility == constants.ACCURACY_CODES.CONFIRMED ? 'accurate' : 'innacurate') : '';

  let credText = '';
  if (postCredibility.length)
    credText = `as ${postCredibility}`;

  questionAskers.forEach(target => {
    if (target.isVerified) {

      const notifyAnswerMailOptions = {
        from: process.env.EMAIL_USER,
        to: target.email,
        subject: `${assessorName} has assessed a post you inquired about on ${constants.SITE_NAME}`,
        html: `<p>Hi ${target.firstName}!</p>
          <p> ${assessorName} has assessed a post that you previously inquired about on ${constants.SITE_NAME} ${credText}.</p>
          ${responseText}
          <p> Click <a href="${postLink}">here</a> to view the article and its assessments.</p>
          <br>
          <p>-The ${constants.SITE_NAME} team</p>`
      }
      transporter.sendMail(notifyAnswerMailOptions, function (err, info) {
        if(err)
          logger.error(err);
        else
          logger.info(info);
      });
  
   }
      
  })
}


async function resolveArbiterSetup(inquirer, arbiter, post, assessment) {
  return new Promise((resolve, reject) => {

    let requestText = assessment.body ? `<p style="font-style:italic;">&ldquo;${assessment.body}&rdquo;</p> <br>` : '';

    if (arbiter.isVerified) {
      htmlText = `<p>Hi ${arbiter.firstName}!</p>
      <p> ${inquirer} has asked for your assessment on ${constants.SITE_NAME}.</p>
      ${requestText}
      <p> Click <a href="${constants.CLIENT_BASE_URL}/posts/${post.id}">here</a> to view the article and
      help them by providing your assessment.</p>
      <br>
      <p>-The ${constants.SITE_NAME} team</p>`
      resolve(htmlText);
    }
    else {
      crypto.randomBytes(20, async function(err, buf) {
        let tokenStr = buf.toString('hex');
        let token = await db.Token.create({
          tokenStr,
          tokenType: constants.TOKEN_TYPES.OUTSIDE_SOURCE_ASSESSMENT,
          expires: null
        });
        token.setSource(arbiter);
        let assessmentVerificationLink = `${constants.CLIENT_BASE_URL}/assessment-request/${post.id}/${tokenStr}`;

        let explainClause = '';
        if (inquirer == 'Someone')
          explainClause = '<p>Please note that we are not disclosing the name of the inquirer because they have indicated that they wish to remain anonymous. </p>';

        htmlText = `<p>Hello!</p>
        <p> ${inquirer} has asked for your assessment on ${constants.SITE_NAME}.
        ${requestText}
        ${constants.SITE_NAME} is a platform where users can help each other by providing their assessment of
        the accuracy of various posts. You can learn more about the platform <a href="${constants.CLIENT_BASE_URL}/about">here</a>.</p>
        <p> You do not need to sign up to help them. You can simply click <a href="${assessmentVerificationLink}">here</a> to view the article and
        provide your assessment.</p>
        ${explainClause}
        <br>
        <p>-The ${constants.SITE_NAME} team</p>`;

        resolve(htmlText)
      })
    }
  })
}

async function notifyArbiters(inquirer, arbiters, post, assessment) {

  arbiters.forEach(arbiter => {
    let notifyQuestionMailOptions;
    resolveArbiterSetup(inquirer, arbiter, post, assessment)
    .then( htmlText => {

      notifyQuestionMailOptions = {
        from: process.env.EMAIL_USER,
        to: arbiter.email,
        subject: `${inquirer} has asked for your assessment on a post on ${constants.SITE_NAME}`,
        html: htmlText
      }
  
      transporter.sendMail(notifyQuestionMailOptions, function (err, info) {
        if(err)
          logger.error(err);
        else
          logger.info(info);
      });
    })

  })
}


module.exports = {
  notifyBoostTargets,
  notifyArbiters,
  notifyInquirers
}
