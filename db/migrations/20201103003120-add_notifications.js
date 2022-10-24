'use strict';
const logger = require('../../lib/logger');


module.exports = {
  up: (queryInterface, Sequelize) => {
    return new Promise(async (resolve, reject) => {
      try {
        await queryInterface.createTable(
          'Notifications', {
            id: {
              type: Sequelize.INTEGER,
              primaryKey: true,
              autoIncrement: true
            },
            text: {
              type: Sequelize.TEXT('long')
            },
            link: {
              type: Sequelize.TEXT('medium')
            },
            seen: {
              type: Sequelize.BOOLEAN
            }, 
            clicked: {
              type: Sequelize.BOOLEAN
            },
            createdAt: {
              type: Sequelize.DATE
            },
            updatedAt: {
              type: Sequelize.DATE
            },
            NotificationTargetId: {
              type: Sequelize.INTEGER,
              references: {
                model: 'Sources',
                key: 'id'
              },
              onUpdate: 'cascade',
              onDelete: 'cascade'
            }
          },
          {
            charset: 'utf8mb4',
          }
        )

        resolve();
      }
      catch(err) {
        console.log(err);
        logger.error(err);
        reject();
      }
    })
  },

  down: (queryInterface, Sequelize) => {
    return new Promise(async (resolve, reject) => {

      try {
        await queryInterface.dropTable('Notifications');
        resolve();
      }
      catch(err) {
        console.log(err);
        logger.error(err);
        reject();
      }
    })
  }
};
