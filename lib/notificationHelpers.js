var Sequelize = require('sequelize');
const Op = Sequelize.Op;
var db  = require('../models');
var constants = require('../lib/constants');
const logger = require('../lib/logger');
var communications = require('../lib/communications');

async function notifyAndEmailAboutQuestion(assessment, assessmentOwner, post, arbiters) {

    let inquirer;
    if (assessment.sourceIsAnonymous)
        inquirer = 'Someone';
    else
        inquirer = assessmentOwner.getFullName();

    let notifReceivers, text;

    if (arbiters.length) {
        notifReceivers = arbiters;
        text = `${inquirer} has asked for your assessment on a post.`
    }
    else {
        notifReceivers = await assessmentOwner.getTrusteds();
        text = `${inquirer} has asked for an assessment on a post.`
    }
        

    let notifProms = [];
    notifReceivers.forEach(arbiter => {
        notifProms.push(db.Notification.create({
            text: text,
            link: `${constants.CLIENT_BASE_URL}/posts/${post.id}`
        }).then(notification => {
            return notification.setNotificationTarget(arbiter);
        }) )
    })

    //only the sources that have been excplicitely specified receive an email about the inquiry, not all a source's trusted sources
    let communicationProm = communications.notifyArbiters(inquirer, arbiters, post, assessment);
    await Promise.all([communicationProm, ...notifProms]);
}


async function notifyAndEmailAboutAnswer(assessment, assessor, post, trusters, prevPosedQuestions) {

    let questionAskersIds = prevPosedQuestions.map(el => el.SourceId);
    let trusterQuestionAskers = trusters.filter(el => questionAskersIds.includes(el.id));
    let inquiriesFromAssessor = prevPosedQuestions.filter(question => question.Arbiters.map(el => el.id).includes(assessor.id));
    let inquirerIds = inquiriesFromAssessor.map(el => el.SourceId);

    let otherQuestionAskers = await db.Source.findAll({
        where: {
            id: {
                [Op.in] : inquirerIds
            }
        }
    })

    let questionAskers = trusterQuestionAskers.concat(otherQuestionAskers);
    
    let notifProms = [];
    questionAskers.forEach(truster => {
        notifProms.push(db.Notification.create({
            text: `${assessor.getFullName()} has assessed a post whose accuracy you wanted to know`,
            link: `${constants.CLIENT_BASE_URL}/posts/${post.id}`
        }).then(notification => {
            return notification.setNotificationTarget(truster);
        }))
    })

    let communicationProm = communications.notifyInquirers(assessment, questionAskers, assessor, post);
    await Promise.all([communicationProm, ...notifProms]);
}

module.exports = {
    notifyAndEmailAboutQuestion,
    notifyAndEmailAboutAnswer
  };
  