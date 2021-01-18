var Sequelize = require('sequelize');
var db  = require('../models');
var constants = require('../lib/constants');
var ogpHelpers = require('./ogpHelpers');
const Op = Sequelize.Op;
var bCrypt = require('bcrypt');
const logger = require('../lib/logger');
var transporter = require('../lib/transporter');
require('dotenv').config();


async function notifyBoostTargets(targets, source, postId) {

  let sender = source.firstName + ' ' + source.lastName;
  let postLink = constants.CLIENT_BASE_URL + '/posts/' + postId;

  for (let target of targets) {

    const passResetMailOptions = {
      from: process.env.EMAIL_USER,
      to: target.email,
      subject:  `${sender} shared an article with you on ${constants.SITE_NAME}`,
      html: `<p>Hi ${target.firstName}!</p>
      <p> ${sender} shared an article with you on ${constants.SITE_NAME}.</p>
      <p> Click <a href="${postLink}">here</a> to view the article.</p>
      <br>
      <p>-The ${constants.SITE_NAME} team</p>`
    };

    transporter.sendMail(passResetMailOptions, function (err, info) {
       if(err)
         logger.error(err);
       else
         logger.info(info);
    });
  }

}

module.exports = {
  notifyBoostTargets
}
