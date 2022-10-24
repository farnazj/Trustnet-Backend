'use strict';
var db = require('../../models');
const logger = require('../../lib/logger');
var constants = require('../../lib/constants');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return new Promise(async (resolve, reject) => {
      try {
        let preferences = await db.Preferences.findAll();
        let allProms = [];

        preferences.forEach(preference => {

          let prefObj = JSON.parse(preference.preferencesBlob);
          let newPrefObj = {
            reheadlineBlackListedWebsites: 'blackListedWebsites' in prefObj ? prefObj.blackListedWebsites: constants.DEFAULT_HEADLINE_BLACKLISTS,
            trustnetBlackListedWebsites: []
          }

          for (const key in prefObj) {
            if (key != 'blackListedWebsites')
              newPrefObj[key] = prefObj[key];
          }
          
          preference.preferencesBlob = JSON.stringify(newPrefObj);
          allProms.push(preference.save());
        })

        await Promise.all(allProms);
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
