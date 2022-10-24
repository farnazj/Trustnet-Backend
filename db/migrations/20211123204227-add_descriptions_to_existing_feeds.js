'use strict';
var db = require('../../models');
const logger = require('../../lib/logger');
var feedHelpers = require('../../lib/feedHelpers');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return new Promise(async (resolve, reject) => {
      try {
        
        let feeds = await db.Feed.findAll({
          include: [{
            model: db.Source,
            as: 'FeedSource'
          }]
        });

        let proms = feeds.map(feed => {
          if (!([1, 2, 3].includes(feed.SourceId)) ) {
            return feedHelpers.getFeed(feed.rssfeed)
            .then(feedHelpers.getFeedMeta)
            .then(meta => {
              console.log(feed.name, meta, '**\n')
              if (meta.description)
                return feed.FeedSource.update({ description: meta.description })
            })
          }
        });

        await Promise.allSettled(proms.filter(prom => prom));
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
