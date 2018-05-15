const ogs = require('open-graph-scraper');
const FeedParser = require('feedparser');
const axios = require('axios');
var models = require('../models');


async function checkFeedUpdate(url){

}

async function getFeed(url) {

  const res = await axios({
    method:'get',
    url:url,
    responseType:'stream'
  });

  const feedparser = new FeedParser();
  return [res.data.pipe(feedparser), feedparser];
}


async function readFeedStream([stream, feedparser]) {

  var res = [];
  return new Promise((resolve, reject) => {

    feedparser.on('readable', function () {
      var stream = this; // `this` is `feedparser`, which is a stream
      var meta = this.meta;
      var item;

      while (item = stream.read()) {
        res.push(item);
      }
    });

    feedparser.stream.on('end', function(){
      resolve(res);
    });

    feedparser.on('error', function (error) {
      reject(error);
   });
  })
}



async function getOGPArticle(article){

  return new Promise((resolve, reject) => {
    ogs({'url':article})
    .then(function (result) {
      resolve(result);
    })
    .catch(function (error) {
      reject(error)
    });
  })

}


async function updateRSSPosts(feeds, source_ids){

  let urls = feeds.map(feed => {return feed.rssfeed});

  let stream_proms = [], post_proms = [], post_boost_proms = [];
  let feed_lookup = [], source_id_lookup = [];

  return new Promise( async (resolve, reject) => {

    urls.forEach(url => stream_proms.push(getFeed(url)
    .then(readFeedStream)
    .catch(err => {
      console.log("1st", err);
    })
    ));

    let rss_format_articles = [];

    Promise.all(stream_proms.map(p => p.catch(() => undefined)))
    .then( async articles_cross_feeds => {
      let ogp_promises = [];

      for (let i = 0 ; i < articles_cross_feeds.length ; i++){
        let articles_in_feed = articles_cross_feeds[i];

        articles_in_feed.forEach(article => {
          ogp_promises.push(getOGPArticle(article.link));
          feed_lookup.push(feeds[i]);
          source_id_lookup.push(source_ids[i]);
         });
      }

      let ogp_articles = await Promise.all(ogp_promises);

      for (let i = 0 ; i < ogp_articles.length ; i++){
        let article = ogp_articles[i];

        let create_post_prom = models.Post.create({
          title: article.data.ogTitle,
          description: article.data.ogDescription,
          url: article.data.ogUrl,
          image: article.data.ogImage.url
        }).then(async post => {
          let source = await models.Source.findById(source_id_lookup[i]);
          post_boost_proms.push(source.addInitiatedPost(post));
          feed_lookup[i].update({lastUpdated: Date.now()});

        }).catch( err => {
          console.log("2nd", err);
        });
        post_proms.push(create_post_prom);

      }

    });
    try{
      await Promise.all(post_proms);
      await Promise.all(post_boost_proms);
      console.log("hatake")
      resolve('resolve');
    }
    catch(err){
      console.log("last", err);
      reject(err);
    }

  });

}

module.exports = {
  updateRSSPosts: updateRSSPosts
}
