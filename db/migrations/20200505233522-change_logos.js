'use strict';
var Sequelize = require('sequelize');
var db = require('../../models');
const logger = require('../../lib/logger');
const Op = Sequelize.Op;

module.exports = {
  up: (queryInterface, Sequelize) => {
    return new Promise(async (resolve, reject) => {

      try {
        let sourcePhotoMapping = {
          'Hacker News: Front Page': 'logos/HackerNews.png',
          'The Guardian': 'logos/guardian.jpg',
          'Features – FiveThirtyEight': 'logos/FiveThirtyEight.png',
          'Politics – FiveThirtyEight': 'logos/FiveThirtyEight.png',
          'Slashdot': 'logos/slashdot.png',
          'BBC': 'logos/bbc.png',
          'Boing Boing': 'logos/boingboing.png'
        };

        let rssSources = await db.Source.findAll({
          where: {
            userName: {
              [Op.in]:  Object.keys(sourcePhotoMapping)
            }
          }
        });

        let photoProms = [];

        rssSources.forEach( source => {
          photoProms.push(source.update({
            photoUrl: sourcePhotoMapping[source.userName]
          }));
        })

        await Promise.all(photoProms);

        resolve();
      }
      catch (err) {
        console.log(err)
        logger.error(err);
        reject();
      }
    })
  },

  down: (queryInterface, Sequelize) => {
    return new Promise(async (resolve, reject) => {

      try {
        resolve();
      }
      catch (err) {
        logger.error(err);
        reject();
      }
    })
  }
};
