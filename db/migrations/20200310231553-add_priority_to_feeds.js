'use strict';
var db = require('../../models');

module.exports = {
  up: (queryInterface, Sequelize) => {

    return new Promise(async (resolve, reject) => {

      try {

        await queryInterface.addColumn(
          'Feeds',
          'lastFetched',
          Sequelize.DATE
        );

        await Promise.all([queryInterface.addColumn(
          'Feeds',
          'priority',
          Sequelize.DOUBLE
        ), queryInterface.addColumn(
          'Feeds',
          'updateRate',
          Sequelize.DOUBLE
        )]);

        await queryInterface.bulkUpdate('Feeds', {
            updateRate: 0,
            priority: Number.MAX_SAFE_INTEGER,
            lastFetched: Sequelize.col('lastUpdated')
          }
        );
        
        await Promise.all([
          queryInterface.removeColumn(
           'Feeds',
           'lastUpdated'
         ),
         queryInterface.removeColumn(
          'Feeds',
          'frequency'
        )
        ])


      }
      catch (err) {
        console.log(err);
      }
    })


    /*
      Add altering commands here.
      Return a promise to correctly handle asynchronicity.

      Example:
      return queryInterface.createTable('users', { id: Sequelize.INTEGER });
    */
  },

  down: (queryInterface, Sequelize) => {
    /*
      Add reverting commands here.
      Return a promise to correctly handle asynchronicity.

      Example:
      return queryInterface.dropTable('users');
    */

    return new Promise(async (resolve, reject) => {

      try {

        await queryInterface.addColumn(
          'Feeds',
          'lastUpdated',
          Sequelize.DATE
        );

        let feeds = await db.Feeds.findAll();
        feeds.forEach(feed => {
          feed.update({
            lastUpdated: feed.lastFetched
          })
        });

        await Promise.all([queryInterface.removeColumn(
          'Feeds',
          'priority'
        ), queryInterface.removeColumn(
          'Feeds',
          'updateRate',
        ), queryInterface.removeColumn(
          'Feeds',
          'lastFetched'
        ), queryInterface.addColumn(
          'Feeds',
          'frequency'
        )]);

        await queryInterface.bulkUpdate('Feeds', {
            frequency: 1
          }
        );

      }
      catch (err) {
        console.log(err);
      }
    })
  }
};
