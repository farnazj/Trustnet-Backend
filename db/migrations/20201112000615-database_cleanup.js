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

        // let newMapping = {
        //   'Cable News Network': 'CNN',
        //   'Fox News Channel': 'Fox News'
        // }

        // let sources = await db.Source.findAll({
        //   where: {
        //     userName: {
        //       [Op.in]: Object.keys(newMapping)
        //     }
        //   }
        // });

        // let proms = [];

        // sources.forEach(source => {
        //   proms.push(source.update({
        //     userName: newMapping[source.userName]
        //   }))
        // })
      
        // await Promise.all(proms);
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
