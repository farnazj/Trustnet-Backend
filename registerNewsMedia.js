var models = require('./models');
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
  rssfeed: 'http://http://feeds.foxnews.com/foxnews/sports'},
]

module.exports = function(){

  generateHash(process.env.ADMIN_KEY).then((entityPassword) => {

    let media_sources = media.map(el => models.Source.findOne({where:{
      rssfeed: el.rssfeed,
    }}).then(source => {
      if (!source){
         models.Source.findOrCreate({where:{
          systemMade: true,
          userName: el.userName,
          rssfeed: el.rssfeed,
          passwordHash: entityPassword,
          email: null
        }})
      }
    }));

      return Promise.all(media_sources);
  });
}
