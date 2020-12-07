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

        let economistFeeds = await db.Feed.findAll({
          where: {
            rssFeed: {
              [Op.like]: '%economist%'
            }
          }
        });

        let changeProms = []
        economistFeeds.forEach(feed => {
          console.log(feed.name);
          changeProms.push(feed.update({
            name: feed.name + ' | The Economist'
          }));
        })

        let economistSourcesProm = economistFeeds.map(feed => {
          return feed.getFeedSource();
        })

        let economistSources = await Promise.all(economistSourcesProm);
        economistSources.forEach(source => {
          console.log(source.userName)
          changeProms.push(source.update({
            userName: source.userName + ' | The Economist',
            photoUrl: 'logos/The-Economist.png'
          }))
        });


        let propublica = await db.Source.findOne({
          where: {
            userName: {
              [Op.like]: '%ProPublica%'
            }
          }
        });

        changeProms.push(propublica.update({
          photoUrl: 'logos/Propublica.png'
        }));


        let wsjFeeds = await db.Feed.findAll({
          where: {
            name: {
              [Op.or]: [{
                [Op.like]: '%WSJ%'
              }, {
                [Op.eq]: 'RSSOpinion'
              }]
            }
          }
        })

        let wsjSourceProms = [];
        
        wsjFeeds.forEach(feed => {
          wsjSourceProms.push(feed.getFeedSource());
          if (feed.name == 'RSSOpinion') {
            changeProms.push(
              feed.update({
                name: 'WSJ.com: ' + feed.name
              })
            )
          }
        })

        let wsjSources = await Promise.all(wsjSourceProms);
        wsjSources.forEach(source => {
          changeProms.push(source.update({
            photoUrl: 'logos/WSJ.png'
          }));

          if (source.userName == 'RSSOpinion') {
            changeProms.push(source.update({
              userName: 'WSJ.com: ' + source.userName
            }))
          }
        })

        let pictureMappings = {
          'Vox': 'logos/Vox.jpg',
          'Vox -  All': 'logos/Vox.jpg',
          'WIRED': 'logos/Wired.jpg',
          'The Washington Post': 'logos/WashingtonPost.jpg',
          'PowerPost': 'logos/WashingtonPost.jpg'
        }

        let sources = await db.Source.findAll({
          where: {
            userName: {
              [Op.in]: Object.keys(pictureMappings)
            }
          }
        });

        sources.forEach(source => {
          changeProms.push(source.update({
            photoUrl: pictureMappings[source.userName]
          }))
        })

        let washingtonPostFeed = await db.Feed.findOne({
          where: {
            name: 'PowerPost'
          }
        });

        if (washingtonPostFeed) {
          changeProms.push(washingtonPostFeed.update({
            name: washingtonPostFeed.name + ' - The Washington Post'
          }));  
        }
        
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
