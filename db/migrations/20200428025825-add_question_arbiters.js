'use strict';
var Sequelize = require('sequelize');
var db = require('../../models');
const logger = require('../../lib/logger');

module.exports = {
  up: (queryInterface, Sequelize) => {
    return new Promise(async (resolve, reject) => {
      try {
        await queryInterface.createTable(
          'AssessmentArbiters', {
            createdAt: {
              type: Sequelize.DATE
            },
            updatedAt: {
              type: Sequelize.DATE
            },
            AssessmentId: {
               type: Sequelize.INTEGER,
               references: {
                 model: 'Assessments',
                 key: 'id'
               },
               onUpdate: 'cascade',
               onDelete: 'cascade'
            },
            SourceId: {
               type: Sequelize.INTEGER,
               references: {
                 model: 'Sources',
                 key: 'id'
               },
               onUpdate: 'cascade',
               onDelete: 'cascade'
            }
          }
        );

      }
      catch(err) {
        console.log(err);
        logger.log(err);
        reject();
      }
    })
  },

  down: (queryInterface, Sequelize) => {
    return new Promise(async (resolve, reject) => {

      try {
        await queryInterface.dropTable('AssessmentArbiters');

        resolve();
      }
      catch (err) {
        logger.error(err);
        reject();
      }
    })
  }
};
