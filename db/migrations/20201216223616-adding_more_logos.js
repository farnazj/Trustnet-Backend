'use strict';
var Sequelize = require('sequelize');
var db = require('../../models');
const logger = require('../../lib/logger');
const Op = Sequelize.Op;

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return new Promise(async (resolve, reject) => {

      try {
        
        let sourceProms = [
          db.Source.update({
            photoUrl: 'logos/guardian.jpg'
          },
          {
            where: {
              userName: {
                [Op.like]: '%| The Guardian%'
              }
            }
          }),

          db.Source.update({
            photoUrl: 'logos/oan.png'
          }, {
            where: {
              userName: {
                [Op.like]: '%One America News%'
              }
            }
          }),

          db.Source.update({
            photoUrl: 'logos/Kotaku.png'
          }, {
            where: {
              userName: {
                [Op.eq]: 'Kotaku'
              }
            }
          }),
          
          db.Source.update({
            photoUrl: 'logos/LATimes.jpeg'
          }, {
            where: {
              userName: {
                [Op.eq]: 'Los Angeles Times'
              }
            }
          }),

          db.Source.update({
            photoUrl: 'logos/Washington-Times.png'
          }, {
            where: {
              userName: {
                [Op.eq]: 'The Washington Times'
              }
            }
          }),

          db.Source.update({
            photoUrl: 'logos/GamersNexus.jpg'
          }, {
            where: {
              userName: {
                [Op.like]: '%Gamers Nexus%'
              }
            }
          }),

          db.Source.update({
            photoUrl: 'logos/The-Hill.png'
          }, {
            where: {
              userName: {
                [Op.like]: '%Hill%'
              }
              
            }
          }),

          db.Source.update({
            photoUrl: 'logos/Washington_Free_Beacon.png'
          }, {
            where: {
              userName: {
                [Op.eq]: 'Washington Free Beacon'
              }
            }
          }),


          db.Source.update({
            photoUrl: 'logos/WSJ.png'
          }, {
            where: {
              userName: {
                [Op.like]: '%Wall Street Journal%'
              }
            }
          })
        ];

        await Promise.all(sourceProms);
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
