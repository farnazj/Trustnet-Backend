var Sequelize = require('sequelize');
var db  = require('../models');
var constants = require('../lib/constants');
const Op = Sequelize.Op;
const logger = require('../lib/logger');

async function notifyAboutQuestion(assessment, assessmentOwner, post, arbiters) {

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

    await Promise.all(notifProms);
}

module.exports = {
    notifyAboutQuestion
  };
  