var db = require('./models');
var routeHelpers = require('./lib/routeHelpers');
var feedHelpers = require('./lib/feedHelpers');
var fs = require("fs");
// var kue = require('kue')
//  , queue = kue.createQueue();
var path = require('path');
var media = JSON.parse(fs.readFileSync(path.join(__dirname, "jsons/media.json")));

module.exports = async function(){

  let entityPassword = await routeHelpers.generateHash(process.env.ADMIN_KEY);

  let mediaProms = media.map((el) => {
    return db.Source.findOrCreate({
      where: {
        userName: el.username,
        photoUrl: el.photoUrl
      },
      defaults: {
        systemMade: true,
        passwordHash: entityPassword,
        email: null,
        isVerified: true
      }
    })
    .then(([source, created]) => {

      // if (created)
      //   queue.create('addNode', {sourceId: source.id}).priority('high').save();

      let feedProms = el.feeds.map( feed => {
        return db.Feed.findOne({
        where: {
          rssfeed: feed.rssfeed
        }
      })
      .then( feedInstance => {
        if (!feedInstance){
          return feedHelpers.getFeed(feed.rssfeed)
          .then(feedHelpers.getFeedMeta)
          .then(meta => {

            // if (source.photoUrl == null) {
            //   let image = Object.entries(meta.image).length === 0 ? null : meta.image.url;
            //   source.update({ photoUrl: image});
            // }

            return db.Feed.create({
              rssfeed: feed.rssfeed,
              name: meta.title,
              description: meta.description,
              updateRate: 0,
              lastFetched: null,
              priority: Number.MAX_SAFE_INTEGER
            }).then(rssFeed => {
              return Promise.all([source.addSourceFeed(rssFeed), rssFeed.setFeedSource(source)]);
            })
          })
        }
      })

      })
      return Promise.all(feedProms);
    });

  })
  return Promise.all(mediaProms);

}
