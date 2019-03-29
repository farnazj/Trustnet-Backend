var db = require('../models');

class FeedQueue {
  constructor(source_feeds) {

    this.queue = [];
    source_feeds.forEach(source => {
      source.SourceFeeds.forEach(feed => {
        this.queue.push([feed, source]);
      })
    })
  }

  static async build() {
    let source_feeds = await db.Source.findAll({
      include: [{
        model: db.Feed,
        as: 'SourceFeeds',
        where: {
          rssfeed: { $ne: null }
        }
      }]
    });

    return new FeedQueue(source_feeds);
  }

  getFeed() {
    let tuple = this.queue.shift();
    this.queue.push(tuple);
    return tuple;
  }

}

module.exports = FeedQueue;
