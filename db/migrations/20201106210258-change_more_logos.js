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
          'The Daily Beast': 'logos/Daily-Beast.jpg',
          'CNBC': 'logos/CNBC.jpg',
          'Fortune': 'logos/Fortune.jpeg',
          'The Associated Press': 'logos/Associated-Press.jpg',
          'National Geographic': 'logos/National-Geographic.jpg',
          'POLITICO': 'logos/politico.jpeg',
          "Infowars: There's a War on for Your Mind!": 'logos/Info-Wars.jpg',
          'Forbes': 'logos/Forbes.jpg',
          'Common Dreams - Breaking News & Views for the Progressive Community': 'logos/Common-Dreams.jpg',
          'Features – FiveThirtyEight': 'logos/FiveThirtyEight.jpg',
          'Politics – FiveThirtyEight': 'logos/FiveThirtyEight.jpg'
        };

        let sources = await db.Source.findAll({
          where: {
            userName: {
              [Op.in]:  Object.keys(sourcePhotoMapping)
            }
          }
        });

        let photoProms = [];

        sources.forEach( source => {
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
