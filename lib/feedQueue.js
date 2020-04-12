var Sequelize = require('sequelize');
var db = require('../models');
var feedHelpers = require('../lib/feedHelpers');
var FastPriorityQueue = require('fastpriorityqueue');
var moment = require('moment');
const logger = require('../lib/logger');
const Op = Sequelize.Op;
const CronJob = require('cron').CronJob;

class FeedQueue {
  constructor(feeds) {

    this.queue = new FastPriorityQueue(function(a, b) {

      if (Math.abs(a.priority - b.priority) >= 0.0000000000000001) {

        if (a.priority > b.priority)
          return true;
        else
          return false;
      }

      if (a.lastFetched === null && b.lastFetched !== null)
        return true;
      if (a.lastFetched !== null && b.lastFetched === null)
        return false;
      if (moment(a.lastFetched).isBefore(b.lastFetched))
        return true;
      if (moment(a.lastFetched).isAfter(b.lastFetched))
        return false;
      return a.rssfeed.localeCompare(b.rssfeed);
    });

    feeds.forEach(feed => {
      this.queue.add(feed);
    })
  }

  static async build() {
    let feeds = await db.Feed.findAll();
    return new FeedQueue(feeds);
  }

  static get feedFreezeTime() {
    return 4; //in minutes
  }

  getUnfrozenTopFeed() {
    let topFeed = this.queue.poll();

    while (typeof topFeed !== 'undefined' && topFeed.lastFetched !== null &&
      moment.utc().diff(topFeed.lastFetched, 'minutes') < FeedQueue.feedFreezeTime ) {
      topFeed = this.queue.poll();
    }
    if (typeof topFeed === 'undefined') {
      db.Feed.findAll()
      .then( feeds => {
        this.queue.heapify(feeds);
        this.queue.trim();
      })
      return null;
    }
    else
      return topFeed;
  }

  async updateFeedsPriorities() {

    let allFeeds = await db.Feed.findAll();
    let updateProms = [];

    for (let feed of allFeeds) {

      if (feed.lastFetched !== null) {

        let timeSinceLastFetch = moment.utc().diff(feed.lastFetched, 'days', true);
        updateProms.push(feed.update({
          priority: feed.updateRate * timeSinceLastFetch
        }))
      }

    }

    Promise.all(updateProms)
    .then( () => {
      this.queue.heapify(allFeeds);
      this.queue.trim();
    })
  }

  initFeedUpdateJobs() {

    let queue = this;

    let updateJob = new CronJob('00 */2 * * * *' , function() {

      let topFeed = queue.getUnfrozenTopFeed();

      if (topFeed !== null) {
        logger.info('going to fetch the feed' + topFeed.rssfeed);
        topFeed.getFeedSource()
        .then( source => {

          feedHelpers.updateFeed([topFeed, source])
          .then(feedChanged => {

            let feed = topFeed;
            let newUpdateRate = feed.lastFetched !== null ? (moment(feed.lastFetched).diff(feed.createdAt, 'days', true) /
            (moment.utc().diff(feed.createdAt, 'days', true))) * feed.updateRate : 0;

            if (feedChanged)
              newUpdateRate += 1/(moment.utc().diff(feed.createdAt, 'days', true));

            feed.update({
              lastFetched: moment.utc(),
              updateRate: newUpdateRate
            })
            .then(() => {
              queue.updateFeedsPriorities()
            });
          })
        })
      }
    })

    updateJob.start();
  }

}

module.exports = FeedQueue;
