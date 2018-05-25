var db = require('./models');
var bCrypt = require('bcrypt');

var generateHash = function(password) {
    return bCrypt.hash(password, bCrypt.genSaltSync(8), null); // a promise
};

var media = [
  {userName: 'NY Times',
  rssfeed: 'http://rss.nytimes.com/services/xml/rss/nyt/World.xml'},
  {userName: 'WashingtonPost',
  rssfeed: 'http://feeds.washingtonpost.com/rss/rss_arts-post'},
  {userName: 'CNN',
  rssfeed: 'http://rss.cnn.com/rss/cnn_allpolitics.rss'},
  {userName: 'FOX News',
  rssfeed: 'http://feeds.foxnews.com/foxnews/sports.rss'},
]

module.exports =  function(){

  generateHash(process.env.ADMIN_KEY).then((entityPassword) => {

    let media_sources = media.map(el => db.Feed.findOne({where:{
      rssfeed: el.rssfeed,
    }}).then(async feed => {
      if (!feed){
        let rss_feed = await db.Feed.create({rssfeed: el.rssfeed});
        let source = await db.Source.create({
          systemMade: true,
          userName: el.userName,
          passwordHash: entityPassword,
          email: null
        });
        return source.addSourceFeed(rss_feed);
      }
    }));

      return Promise.all(media_sources);
  });
}
