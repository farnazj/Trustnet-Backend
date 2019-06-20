var Sequelize = require('sequelize');
var db = require('../models');
var feedHelpers = require('../lib/feedHelpers');
const Op = Sequelize.Op;
const CronJob = require('cron').CronJob;

class FeedQueue {
  constructor(source_feeds) {

    this.queues = {};
    source_feeds.forEach(source => {
      source.SourceFeeds.forEach(feed => {
        if (!(feed.frequency in this.queues))
          this.queues[feed.frequency] = [];

        this.queues[feed.frequency].push([feed, source]);
      })
    })
  }

  static async build() {
    let source_feeds = await db.Source.findAll({
      include: [{
        model: db.Feed,
        as: 'SourceFeeds',
        where: {
          rssfeed: { [Op.ne]: null }
        }
      }]
    });

    return new FeedQueue(source_feeds);
  }

  getFeed(i) {
    let tuple = this.queues[i].shift();
    this.queues[i].push(tuple);
    return tuple;
  }

  async addFeed(feed) {
    let source = await feed.getFeedSource();
    if (!(feed.frequency in this.queues))
      this.queues[feed.frequency] = [];

    this.queues[feed.frequency].push([feed, source])
  }

  initFeedUpdateJobs() {

    //TODO:change
    let priorityUpdateMapping = {
      1: '0 */5 * * * *',
      2: '30 */11 * * * *',
      3: '15 */20 * * * *',
      4: '15 */30 * * * *',
    }

    let feedJobs = []
    for (let [key, value] of Object.entries(priorityUpdateMapping)) {
      feedJobs.push(new CronJob(value, function() {
        feedHelpers.updateFeeds(key);
      }))
    }

    for (let job of feedJobs)
      job.start();
  }

}

module.exports = FeedQueue;
