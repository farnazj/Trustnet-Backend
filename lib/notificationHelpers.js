var Sequelize = require('sequelize');
var db  = require('../models');
var constants = require('../lib/constants');
const Op = Sequelize.Op;
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
    await communications.notifyArbiters(inquirer, arbiters, post);
    await Promise.all(notifProms);
}


async function notifyAboutAnswer(assessment, assessor, post, trusters, prevPosedQuestions) {

    let questionAskersIds = prevPosedQuestions.map(el => el.SourceId);
    let questionAskers = trusters.filter(el => questionAskersIds.includes(el.id));
    
    let notifProms = [];
    questionAskers.forEach(truster => {
        notifProms.push(db.Notification.create({
            text: `${assessor.getFullName()} has assessed a post whose validity you wanted to know`,
            link: `${constants.CLIENT_BASE_URL}/posts/${post.id}`
        }).then(notification => {
            return notification.setNotificationTarget(truster);
        }))
    })
    
    await Promise.all(notifProms);
}

module.exports = {
    notifyAndEmailAboutQuestion,
    notifyAboutAnswer
  };
  