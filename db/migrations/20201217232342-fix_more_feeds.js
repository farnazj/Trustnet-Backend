'use strict';
var Sequelize = require('sequelize');
var db = require('../../models');
const logger = require('../../lib/logger');
var feedHelpers = require('../../lib/feedHelpers');
const Op = Sequelize.Op;

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return new Promise(async (resolve, reject) => {

      try {

        let sourceProm = db.Source.findOne({
          where: {
            userName: 'AllSides'
          }
        });

        let rssFeed = 'https://www.allsides.com/news/rss';

        feedHelpers.getFeed(rssFeed)
        .then(rssFeed)
        .then( async (meta) => {

          let feedProm = db.Feed.create({
            rssfeed: rssFeed,
            name: 'AllSides',
            description: meta.description,
            updateRate: 0,
            lastFetched: null,
            priority: Number.MAX_SAFE_INTEGER
          })


          let [feed, source] = await Promise.all([feedProm, sourceProm]);
          await Promise.all([source.addSourceFeed(feed), feed.setFeedSource(source)]);

          resolve();
        })
        
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
      }
      catch (err) {
        console.log(err)
        logger.error(err);
        reject();
      }
    })
  }
};
