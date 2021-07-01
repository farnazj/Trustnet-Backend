'use strict';
var Sequelize = require('sequelize');
const logger = require('../../lib/logger');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    
     return new Promise(async (resolve, reject) => {

      try {
        await queryInterface.createTable('HeadlineOrigins', {
          id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true
          },
          url: {
            type: Sequelize.TEXT('medium')
          },
          createdAt: {
            type: Sequelize.DATE
          },
          updatedAt: {
            type: Sequelize.DATE
          }
        }, {
          charset: 'utf8mb4'
        })

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
