'use strict';
var db = require('../../models');
const logger = require('../../lib/logger');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return new Promise(async (resolve, reject) => {
      try {

        await queryInterface.addColumn(
          'Comments',
          'originTime',
          Sequelize.DATE
        );

        let comments = await db.Comment.findAll();
        let proms = comments.map(comment => {
          return comment.update({
            originTime: comment.createdAt
          })
        })

        await Promise.all(proms);
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
