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

        let feed = await db.Feed.findOne({
          where: {
            rssfeed: {
              [Op.eq]: 'http://rss.accuweather.com/rss/mt-blog-rss.asp?blog=headlines'
            }
          }
        });

        let feedProms = [];

        feedProms.push(feed.update({
          name: 'AccuWeather'
        }));

        console.log(process.env.ADMIN_KEY)

        let entityPassword = await routeHelpers.generateHash(process.env.ADMIN_KEY);

        let source = await db.Source.create({
          userName: 'AccuWeather',
          photoUrl: 'logos/AccuWeather.png',
          systemMade: true,
          passwordHash: entityPassword,
          email: null,
          isVerified: true
        })

        feedProms.push(source.addSourceFeed(feed));
        feedProms.push(feed.setFeedSource(source));

        Promise.all(feedProms)

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
