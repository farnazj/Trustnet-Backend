'use strict';
var Sequelize = require('sequelize');
var db = require('../../models');
const logger = require('../../lib/logger');
const Op = Sequelize.Op;


module.exports = {
  up: async (queryInterface, Sequelize) => {
    return new Promise(async (resolve, reject) => {

      try {

        let standaloneTitles = await db.StandaloneTitle.findAll();

        let idToStandaloneTitleMapping = {};
        standaloneTitles.forEach((standaloneTitle) => {
          idToStandaloneTitleMapping[standaloneTitle.id] = standaloneTitle;
        });

        let oldCustomTitles = await db.CustomTitle.findAll({
          attributes: [`id`, `text`, `version`, `setId`, `createdAt`, `updatedAt`, `SourceId`, `StandaloneTitleId`]
        })
        
        await queryInterface.createTable(
          'OriginalCustomTitles', {
            createdAt: {
              type: Sequelize.DATE
            },
            updatedAt: {
              type: Sequelize.DATE
            },
            CustomTitleId: {
              type: Sequelize.INTEGER,
              references: {
                model: 'CustomTitles',
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
          },
          {
            charset: 'utf8mb4',
          }
        );

        let standaloneCustomTitleTuples = [];
        
        oldCustomTitles.forEach((customTitle) => {
          console.log(customTitle, customTitle.dataValues.StandaloneTitleId)
          if (customTitle.dataValues.StandaloneTitleId) {
            let standaloneTitleInstance = idToStandaloneTitleMapping[customTitle.dataValues.StandaloneTitleId];
            standaloneCustomTitleTuples.push([standaloneTitleInstance, customTitle]);
          }
        })
        // reject();

        await queryInterface.removeColumn('CustomTitles', 'StandaloneTitleId');

        let associationProms = [];
        standaloneCustomTitleTuples.forEach(tuple => {
          associationProms.push(tuple[0].addStandaloneCustomTitles(tuple[1]));
        });

        await Promise.all(associationProms);
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
