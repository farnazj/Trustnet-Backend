'use strict';
var db = require('../../models');
const logger = require('../../lib/logger');
var util = require('../../lib/util');
var constants = require('../../lib/constants');
var moment = require('moment');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return new Promise(async (resolve, reject) => {

      try {
  
        await queryInterface.createTable('StandaloneTitles', {
          id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true
          },
          text: {
            type: Sequelize.TEXT('medium')
          },
          hash: {
            type: Sequelize.STRING
          },
          createdAt: {
            type: Sequelize.DATE
          },
          updatedAt: {
            type: Sequelize.DATE
          },
          PostId: {
            type: Sequelize.INTEGER,
            references: {
              model: 'Posts',
              key: 'id'
            },
            onUpdate: 'cascade',
            onDelete: 'cascade'
          },
        }, {
          charset: 'utf8mb4'
        });

        await queryInterface.addColumn('CustomTitles', 'StandaloneTitleId', {
          type: Sequelize.INTEGER,
          references: {
            model: 'StandaloneTitles',
            key: 'id'
          },
          onUpdate: 'cascade',
          onDelete: 'cascade'
        });

        let postsWCustomTitles = await db.Post.findAll({
          include: [{
            model: db.CustomTitle,
            as: 'PostCustomTitles',
            required: true
          }]
        });
        

        let proms = postsWCustomTitles.map(post => {
          console.log(post.PostCustomTitles.map(customTitle => customTitle.createdAt))
          return db.StandaloneTitle.create({
            text: post.title,
            hash: util.hashCode(util.uncurlify(post.title.substr(0, constants.LENGTH_TO_HASH))),
            createdAt: moment.min(...post.PostCustomTitles.map(customTitle => moment(customTitle.createdAt))),
            updatedAt: moment.min(...post.PostCustomTitles.map(customTitle => moment(customTitle.updatedAt)))
          })
          .then(standaloneTitle => {          
            return Promise.all([post.setStandaloneTitle(standaloneTitle),
              standaloneTitle.addStandaloneCustomTitles(post.PostCustomTitles)]);
          })
        });

        await queryInterface.removeColumn('CustomTitles', 'PostId'),

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
      resolve();
    })
  }
};
