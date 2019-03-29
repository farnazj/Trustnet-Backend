var db = require('./models');
var bCrypt = require('bcrypt');
var fs = require("fs");

var media = JSON.parse(fs.readFileSync("./jsons/media.json"));

var generateHash = function(password) {
  return bCrypt.hash(password, bCrypt.genSaltSync(8), null); // a promise
};

module.exports =  function(){

  return generateHash(process.env.ADMIN_KEY).then((entityPassword) => {

    let media_sources = media.map(el => db.Feed.findOne({ where: {
      rssfeed: el.rssfeed,
      name: el.name
    }}).then(async feed => {
      if (!feed){
        let rss_feed = await db.Feed.create({
          rssfeed: el.rssfeed,
          name: el.name
        });
        let source = await db.Source.findOrCreate(
          {
            where: {
              systemMade: true,
              userName: el.username,
              passwordHash: entityPassword,
              email: null
              }
          });
        return source[0].addSourceFeed(rss_feed);
      }
    }));

      return Promise.all(media_sources);
  });
}
