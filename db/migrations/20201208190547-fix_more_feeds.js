'use strict';
var Sequelize = require('sequelize');
var db = require('../../models');
const logger = require('../../lib/logger');
var constants = require('../../lib/constants');
const Op = Sequelize.Op;

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return new Promise(async (resolve, reject) => {

      try {

        let politicoFeeds = await db.Feed.findAll({
          where: {
            rssFeed: {
              [Op.like]: '%politico%'
            }
          }
        });

        let changeProms = []
        politicoFeeds.forEach(feed => {
          console.log(feed.name);
          changeProms.push(feed.update({
            name: feed.name + ' | POLITICO'
          }));
        })

        let politicoSourcesProm = politicoFeeds.map(feed => {
          return feed.getFeedSource();
        })

        let politicoSources = await Promise.all(politicoSourcesProm);
        politicoSources.forEach(source => {
          console.log(source.userName)
          changeProms.push(source.update({
            userName: source.userName + ' | POLITICO',
            photoUrl: 'logos/politico.jpeg'
          }))
        });
        
        await Promise.all(changeProms);
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
