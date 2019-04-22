var db = require('./models');
var bCrypt = require('bcrypt');
var fs = require("fs");

var media = JSON.parse(fs.readFileSync("./jsons/media.json"));

var generateHash = function(password) {
  return bCrypt.hash(password, bCrypt.genSaltSync(8), null); // a promise
};

module.exports = async function(){

  let entityPassword = await generateHash(process.env.ADMIN_KEY);

  let media_proms = media.map((el) => {
    return db.Source.findOrCreate({
      where: {
        userName: el.username,
        photoUrl: el.photoUrl
        },
      defaults: {
        systemMade: true,
        passwordHash: entityPassword,
        email: null
      }
    })
    .then(source => {

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
              return source[0].addSourceFeed(rss_feed);
          })
        }
      })

      })
      return Promise.all(feed_proms);
    });

  })
  return Promise.all(media_proms);

}
