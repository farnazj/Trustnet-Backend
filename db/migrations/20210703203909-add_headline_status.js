'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return new Promise(async (resolve, reject) => {

      try {
        await queryInterface.createTable('HeadlineStatuses', {
          id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true
          },
          isEncountered: {
            type: Sequelize.BOOLEAN
          },
          isWithheld: {
            type: Sequelize.BOOLEAN
          },
          createdAt: {
            type: Sequelize.DATE
          },
          updatedAt: {
            type: Sequelize.DATE
          },
          SourceId: {
            type: Sequelize.INTEGER,
            references: {
              model: 'Sources',
              key: 'id'
            },
            onUpdate: 'cascade',
            onDelete: 'cascade'
          },
          StandaloneTitleId: {
            type: Sequelize.INTEGER,
            references: {
              model: 'StandaloneTitles',
              key: 'id'
            },
            onUpdate: 'cascade',
            onDelete: 'cascade'
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
