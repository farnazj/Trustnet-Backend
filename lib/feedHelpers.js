const FeedParser = require('feedparser');
const axios = require('axios');
var moment = require('moment');
var db = require('../models');
var routeHelpers = require('./routeHelpers');
var ogpHelpers = require('./ogpHelpers');


async function getFeed(feed) {

  return new Promise(async (resolve, reject)=>{
    try{
      // if (!feed.lastUpdated || (Date.now() - feed.lastUpdated)/(3600*1000) > 0.5) {

      let head_response = await axios({
        method:'head',
        url: feed.rssfeed
      });

      if (!feed.lastUpdated || head_response.headers['last-modified'] == null ||
        moment(head_response.headers['last-modified']).isAfter(feed.lastUpdated)){
        console.log('feed not updated yet or has changed')

        const res = await axios({
          method:'get',
          url: feed.rssfeed,
          responseType:'stream'
        });

        const feedparser = new FeedParser();
        resolve([res.data.pipe(feedparser), feedparser]);
      }
      else {
        console.log('about to reject feed ', feed.rssfeed);
        reject(new Error(`feed ${feed.rssfeed} not changed`));
      }

      // }
      // else {
      //   console.log('about to reject feed ', feed.rssfeed);
      //   reject(new Error(`feed ${feed.rssfeed} not changed`));
      // }

  }
  catch(err){
    reject(new Error(`something went wrong in fetching the feed ${err}`));
  }

  })

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


async function updateRSSPosts(feed, source){

  return getFeed(feed)
  .then(readFeedStream)
  .then(articles_in_feed =>{
    return Promise.all(articles_in_feed.map(article => {

      return db.Post.findOne({where: {Url: article.guid}}).then(post =>{

        if (!post){
          return ogpHelpers.getOGPArticle(article.guid).then(article_ogp =>{

            return db.Post.create({
              title: article_ogp.data.ogTitle,
              description: article_ogp.data.ogDescription,
              url: article.guid, //article_ogp.data.ogUrl,
              image: article_ogp.data.ogImage.url
            }).then(db_post =>{
                feed.update({lastUpdated: moment()});
                return routeHelpers.initiatePost(source, db_post);
            }).catch(err => {
              console.log("Couldn't create post or add it to the initated posts of user.", err);
            })

          }).catch(err => {
            console.log("Couldn't retrieve the ogp of the article.", err)
          })

        }

      }).catch(err => {
        console.log("Sth went wrong with fetching the post from the db", err);
      })
    })
    )
  }).catch(err => {
    console.log("Sth went wrong with fetching the feed", err)
  })

}


function updateFeeds() {

  let [feed, source] = feedQueue.getFeed();
  console.log('updating feed ', feed.rssfeed)
  updateRSSPosts(feed, source);
}


module.exports = {
  updateFeeds
}
