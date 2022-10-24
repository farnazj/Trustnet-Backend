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
    let communicationProm = communications.notifyArbitersOfRequest(inquirer, arbiters, post, assessment);
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

    let communicationProm = communications.notifyInquirersOfAssessment(assessment, questionAskers, assessor, post);
    await Promise.all([communicationProm, ...notifProms]);
}


async function notifyAndEmailAboutComment(comment, commentPoster, post, parentInstance) {
    
    let notifProms = [];
    let communicationProm = new Promise((resolve) => { resolve(); });
    /*
    if the comment is a reply to a comment or an assessment, and the author of the parent comment/assessment
    is different from the author of the reply, notify the author of the parent both through notifications and
    email
    */
    if (comment.parentId !== null && parentInstance.SourceId != comment.SourceId) {

        let parentAuthor = await db.Source.findOne({
            where: {
                id: parentInstance.SourceId
            }
        })
        let parentType = comment.parentType == 1 ? 'comment' : 'assessment';

        notifProms.push(db.Notification.create({
            text: `${commentPoster.getFullName()} has replied to your ${parentType}`,
            link: `${constants.CLIENT_BASE_URL}/posts/${post.id}`
        }).then(notification => {
            return notification.setNotificationTarget(parentAuthor);
        }))

        communicationProm = communications.notifyParentAuthorOfComment(parentAuthor, parentType, commentPoster, post);
    }


    let postBoosts = await db.Boost.findAll({
        where: {
            PostId: post.id
        },
        include: [{
            model: db.Source,
            as: 'Booster'
        }]
    });

    /*
    notify the booster of the post about the new comment if the booster is not the poster of the new comment themselves and
    the booster is not a generic systemMade news account and the new comment is either a root comment or is not a reply to 
    another comment whose author has just been notified about the reply (because we do not want to notify them a second time
    about the same newly posted comment)
    */
    let boosters = postBoosts.map(boost => boost.Booster).filter(booster => booster.id != commentPoster.id &&
        booster.systemMade != 1 && ( comment.parentId == null || booster.id != parentInstance.SourceId ));

    boosters.forEach(booster => {
        notifProms.push(db.Notification.create({
            text: `${commentPoster.getFullName()} has commented on a post that you shared`,
            link: `${constants.CLIENT_BASE_URL}/posts/${post.id}`
        }).then(notification => {
            return notification.setNotificationTarget(booster);
        }))
    })

    
    await Promise.all([communicationProm, ...notifProms]);

}


module.exports = {
    notifyAndEmailAboutQuestion,
    notifyAndEmailAboutAnswer,
    notifyAndEmailAboutComment
  };
  