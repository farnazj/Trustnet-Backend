'use strict';
var Sequelize = require('sequelize');
var db = require('../../models');
const logger = require('../../lib/logger');
var routeHelpers = require('../../lib/routeHelpers');
const Op = Sequelize.Op;

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return new Promise(async (resolve, reject) => {

      try {

        let feedProms = [];

        let origSourceProm = db.Source.findOne({
          where: {
            userName: 'CNBC'
          }
        });

        let feed = await db.Feed.findOne({
          where: {
            rssfeed: {
              [Op.eq]: 'https://www.cnbc.com/id/100003114/device/rss/rss.html'
            }
          }
        });

        let extraSource = await feed.getFeedSource();
        await extraSource.destroy();

        let origSource = await origSourceProm;
        feedProms.push(feed.update({
          name: 'CNBC'
        }));
        feedProms.push(origSource.addSourceFeed(feed));
        feedProms.push(feed.setFeedSource(origSource));


        let updateProm = db.Source.update({
          photoUrl: 'logos/citizen-free-press.png'
        },{
          where: {
            userName: {
              [Op.eq]: 'CITIZEN FREE PRESS'
            }
          }
        });

        feedProms.push(updateProm);
        await Promise.all(feedProms);

        resolve();
      }
      catch (err) {
        console.log(err)
        logger.error(err);
        reject();
      }
    })
  },

  down: async (queryInterface, Sequelize) => {
    return new Promise(async (resolve, reject) => {

      try {
        resolve();
      }
      catch (err) {
        console.log(err)
        logger.error(err);
        reject();
      }
    })
  }
};
