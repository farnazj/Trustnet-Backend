const FeedParser = require('feedparser');
const axios = require('axios');
var moment = require('moment');
var db = require('../models');
var routeHelpers = require('./routeHelpers');
var ogpHelpers = require('./ogpHelpers');
var util = require('./util');
const logger = require('../lib/logger');

async function needsUpdate(feed) {
  return new Promise(async (resolve, reject)=> {
    try {
      let head_response = await axios({
        method:'head',
        url: feed.rssfeed
      });

      if (!feed.lastUpdated || head_response.headers['last-modified'] == null ||
        moment(head_response.headers['last-modified']).isAfter(feed.lastUpdated)){

        resolve(true);
      }
      else {
        resolve(false);
      }
    }
    catch(err) {
      reject(new Error(`something went wrong in fetching the head of feed ${err}`));
    }
  })
}

async function getFeed(feedURL) {

  return new Promise(async (resolve, reject)=>{
    try{
      const res = await axios({
        method:'get',
        url: feedURL,
        responseType:'stream'
      });

      const feedparser = new FeedParser();
      resolve([res.data.pipe(feedparser), feedparser]);
    }
    catch(err){
      reject(new Error(`something went wrong in fetching the feed ${err}`));
    }
  })

}

async function getFeedMeta([stream, feedparser]) {
  return new Promise((resolve, reject) => {

    feedparser.on('readable', function () {
      var stream = this; // `this` is `feedparser`, which is a stream
      var meta = this.meta;
      resolve({title: meta.title, image: meta.image, description: meta.description});
    });

    feedparser.on('error', function (error) {
      reject(error);
    });
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

  return needsUpdate(feed)
  .then(res => {
    if (res) {
      return getFeed(feed.rssfeed)
      .then(readFeedStream)
      .then(articles_in_feed =>{
        return Promise.all(articles_in_feed.map(article => {

          return db.Post.findOne({where: {Url: article.guid}}).then(post => {

            if (!post){
              return ogpHelpers.getOGPArticle(article.guid).then(article_ogp => {

                return db.Post.create({
                  title: article_ogp.data.ogTitle,
                  description: article_ogp.data.ogDescription,
                  body: util.sanitize(article.description, article_ogp.data.ogImage.url),
                  url: article.guid, //article_ogp.data.ogUrl,
                  image: article_ogp.data.ogImage.url
                }).then(db_post =>{
                    feed.update({lastUpdated: moment()});
                    return routeHelpers.initiatePost(source, db_post);
                }).catch(err => {
                  logger.error("Couldn't create post or add it to the initated posts of user. " + err);
                })

              }).catch(err => {
                logger.error("Couldn't retrieve the ogp of the article. " + err)
              })

            }

          }).catch(err => {
            logger.error("Sth went wrong with fetching the post from the db " + err);
          })
        })
        )
      }).catch(err => {
        logger.error("Sth went wrong with fetching the feed " + err)
      })
    }
  })
  .catch(err => {
    logger.error("Sth went wrong with fetching the feed head " + err)
  })
}

function updateFeeds(i) {

  if (feedQueue.queues[i]) {
    let [feed, source] = feedQueue.getFeed(i);
    updateRSSPosts(feed, source);
  }
}

module.exports = {
  updateFeeds,
  getFeed,
  getFeedMeta
}
