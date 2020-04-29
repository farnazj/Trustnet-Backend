'use strict';
var db = require('../../models');
const logger = require('../../lib/logger');

module.exports = {
  up: (queryInterface, Sequelize) => {
    return new Promise(async (resolve, reject) => {
      try {
        await queryInterface.addColumn(
          'Assessments',
          'sourceIsAnonymous',
          Sequelize.BOOLEAN
        );

        await queryInterface.bulkUpdate('Assessments', {
            sourceIsAnonymous: true,
          }, {
            postCredibility: 0
          },
        );

        resolve();
      }
      catch(err) {
        console.log(err)
        logger.error(err);
        reject();
      }
    })
  },

  down: (queryInterface, Sequelize) => {
    return new Promise(async (resolve, reject) => {
      try {
        await queryInterface.removeColumn(
          'Assessments',
          'sourceIsAnonymous'
        )
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
