var db = require('./models');
var routeHelpers = require('./lib/routeHelpers');
var bCrypt = require('bcrypt');
var fs = require("fs");
var kue = require('kue')
 , queue = kue.createQueue();

var media = JSON.parse(fs.readFileSync("./jsons/media.json"));

module.exports = async function(){

  let entityPassword = await routeHelpers.generateHash(process.env.ADMIN_KEY);

  let media_proms = media.map((el) => {
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
    .spread((source, created) => {

      if (created)
        queue.create('addNode', {sourceId: source.id}).priority('high').save();

      let feed_proms = el.feeds.map( feed => {
        return db.Feed.findOne({
        where: {
          rssfeed: feed.rssfeed
        }
      })
      .then( feed_inst => {
        if (!feed_inst){
          return db.Feed.create({
            rssfeed: feed.rssfeed,
            name: feed.name
          }).then( rss_feed => {
              return source.addSourceFeed(rss_feed);
          })
        }
      })

      })
      return Promise.all(feed_proms);
    });

  })
  return Promise.all(media_proms);

}
