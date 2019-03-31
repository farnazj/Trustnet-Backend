var db = require('./models');
var bCrypt = require('bcrypt');
var fs = require("fs");

var media = JSON.parse(fs.readFileSync("./jsons/media.json"));

var generateHash = function(password) {
  return bCrypt.hash(password, bCrypt.genSaltSync(8), null); // a promise
};

module.exports = function(){

  return generateHash(process.env.ADMIN_KEY).then( (entityPassword) => {

    let media_sources = media.map(async (el) => {
      let source = await db.Source.findOrCreate({
          where: {
            userName: el.username,
            },
          defaults: {
            systemMade: true,
            passwordHash: entityPassword,
            email: null
          }
        });

        return el.feeds.map(feed => db.Feed.findOne({
          where: {
            rssfeed: feed.rssfeed
          }
        })
        .then(async feed_inst => {
          if (!feed_inst){
            let rss_feed = await db.Feed.create({
              rssfeed: feed.rssfeed,
              name: feed.name
            });
            return source[0].addSourceFeed(rss_feed);
         }
       }));

      })
      return Promise.all(media_sources);
  });
}
