'use strict';
var db = require('../../models');
const logger = require('../../lib/logger');

module.exports = {
  up: (queryInterface, Sequelize) => {

    return new Promise(async (resolve, reject) => {

      try {
        // await Promise.all([queryInterface.addColumn(
        //   'Posts',
        //   'publishedDate',
        //   Sequelize.DATE
        // ), queryInterface.addColumn(
        //   'Posts',
        //   'author',
        //   Sequelize.STRING
        // )]);
        //
        // await queryInterface.bulkUpdate('Posts', {
        //     publishedDate: Sequelize.col('updatedAt'),
        //     author: null
        //   }
        // );
        resolve();
      }
      catch (err) {
        logger.error(err);
        reject();
      }
    })
  },

  down: (queryInterface, Sequelize) => {

    return new Promise(async (resolve, reject) => {

      try {
        // await Promise.all([queryInterface.removeColumn(
        //   'Posts',
        //   'publishedDate',
        // ), queryInterface.removeColumn(
        //   'Posts',
        //   'author',
        // )]);

        resolve();
      }
      catch (err) {
        logger.error(err);
        reject();
      }
    })
  }
};
