'use strict';
const logger = require('../../lib/logger');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return new Promise(async (resolve, reject) => {

      try {
        await queryInterface.createTable('URLRedirections', {
          id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true
          },
          originURL: {
            type: Sequelize.STRING,
            isUrl: true
          },
          targetURL: {
            type: Sequelize.STRING,
            isUrl: true
          },
          lastAccessTime: {
            type: Sequelize.DATE
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
      catch(err) {
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
      catch(err) {
        console.log(err)
        logger.error(err);
        reject();
      }
    })
  }
};
