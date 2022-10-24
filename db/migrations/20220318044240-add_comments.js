'use strict';
const logger = require('../../lib/logger');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return new Promise(async (resolve, reject) => {
      try {
        // await queryInterface.createTable('Comments', {
        //   id: {
        //     type: Sequelize.INTEGER,
        //     primaryKey: true,
        //     autoIncrement: true
        //   },
        //   body: {
        //     type: Sequelize.TEXT('long'),
        //   },
        //   version: {
        //     type: Sequelize.INTEGER,
        //     defaultValue: 1
        //   },
        //   setId: {
        //     type: Sequelize.UUID
        //   },
        //   parentType: {
        //     type: Sequelize.INTEGER
        //   },
        //   parentId: {
        //     type: Sequelize.INTEGER
        //   },
        //   parentSetId: {
        //       type: Sequelize.UUID
        //   },
        //   rootType: {
        //       type: Sequelize.INTEGER
        //   },
        //   rootSetId: {
        //       type: Sequelize.UUID
        //   },
        //   createdAt: {
        //     type: Sequelize.DATE
        //   },
        //   updatedAt: {
        //     type: Sequelize.DATE
        //   },
        //   PostId: {
        //     type: Sequelize.INTEGER,
        //     references: {
        //       model: 'Posts',
        //       key: 'id'
        //     },
        //     onUpdate: 'cascade',
        //     onDelete: 'cascade'
        //   },
        //   SourceId: {
        //     type: Sequelize.INTEGER,
        //     references: {
        //       model: 'Sources',
        //       key: 'id'
        //     },
        //     onUpdate: 'cascade',
        //     onDelete: 'cascade'
        //   },
        // }, {
        //   charset: 'utf8mb4'
        // });

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

