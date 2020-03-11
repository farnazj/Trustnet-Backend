const FeedParser = require('feedparser');
const axios = require('axios');
var moment = require('moment');
var db = require('../models');
var routeHelpers = require('./routeHelpers');
var ogpHelpers = require('./ogpHelpers');
var util = require('./util');
const logger = require('../lib/logger');

async function needsUpdate(feed) {

  return new Promise(async (resolve, reject) => {
    try {
      let headResponse = await axios({
        method:'head',
        url: feed.rssfeed
      });

      if (!feed.lastFetched || headResponse.headers['last-modified'] == null ||
        moment(headResponse.headers['last-modified']).isAfter(feed.lastFetched)) {

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

  return new Promise(async (resolve, reject) => {
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
  });

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

    feedparser.stream.on('end', function() {
      resolve(res);
    });

    feedparser.on('error', function (error) {
      reject(error);
    });
  })
}


async function updateFeed([feed, source]) {

  return needsUpdate(feed)
  .then(res => {
    if (res) {
      return getFeed(feed.rssfeed)
      .then(readFeedStream)
      .then(articlesInFeed => {

        let feedChanged = false;
        return Promise.all(articlesInFeed.map(article => {

          return db.Post.findOne({where: {Url: article.guid}}).then(post => {

            if (!post) {
              return ogpHelpers.getOGPArticle(article.guid).then(articleOgp => {

                return db.Post.create({
                  title: articleOgp.data.ogTitle,
                  description: articleOgp.data.ogDescription,
                  body: util.sanitize(article.description, articleOgp.data.ogImage.url),
                  url: article.guid, //article_ogp.data.ogUrl,
                  image: articleOgp.data.ogImage.url
                }).then(dbPost => {
                    if (!feedChanged)
                      feedChanged = true;

                    return routeHelpers.initiatePost(source, dbPost);
                }).catch(err => {
                  logger.error("Couldn't create post or add it to the initated posts of user. " + err);
                })

              }).catch(err => {
                logger.error("Couldn't retrieve the ogp of the article. " + JSON.stringify(err))
              })

            }

          }).catch(err => {
            logger.error("Sth went wrong with fetching the post from the db " + err);
          })
        }))
        .then( () => {

          let newUpdateRate = feed.lastFetched !== null ? (moment(feed.lastFetched).diff(feed.createdAt, 'days', true) /
          (moment().diff(feed.createdAt, 'days', true))) * feed.updateRate : 0;

          if (feedChanged)
            newUpdateRate += 1/(moment().diff(feed.createdAt, 'days', true));

          feed.update({
            lastFetched: moment(),
            updateRate: newUpdateRate
          })
          .then(() =>
            feedQueue.updateFeedsPriorities()
          );

        })
      }).catch(err => {
        logger.error("Sth went wrong with fetching the feed " + err)
      })
    }
  })
  .catch(err => {
    logger.error("Sth went wrong with fetching the feed head " + err)
  })
}


module.exports = {
  updateFeed,
  getFeed,
  getFeedMeta
}
