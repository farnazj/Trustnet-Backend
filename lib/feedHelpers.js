const FeedParser = require('feedparser');
const axios = require('axios');
var moment = require('moment');
var db = require('../models');
var routeHelpers = require('./routeHelpers');
var metaScraperHelpers = require('./metaScraperHelpers');
var util = require('./util');
const logger = require('../lib/logger');
var Sequelize = require('sequelize');
const Op = Sequelize.Op;


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

  let feedChanged = false;

  return needsUpdate(feed)
  .then(needsUpdate => {

    if (needsUpdate) {
      return getFeed(feed.rssfeed)
      .then(readFeedStream)
      .then(articlesInFeed => {

        return Promise.all(articlesInFeed.map(article => {

          return db.Post.findOne({
            where: {
              Url: {
                [Op.in]: [article.guid, article.link, article.origlink, article.permalink]
              }
            }
          }).then(post => {

            if (!post) {

              if (!feedChanged)
                feedChanged = true;

              return metaScraperHelpers.getArticleMetaData(article.guid)
              .then(articleMeta => {

                return db.Post.create({
                  title: articleMeta.title,
                  description: articleMeta.description,
                  body: articleMeta.description, //util.sanitize(article.description, articleOgp.data.ogImage.url),
                  url: article.guid,
                  image: articleMeta.image,
                  author: articleMeta.author,
                  publishedDate: articleMeta.date ? articleMeta.date :
                  (article.pubDate ? article.pubDate : moment()),
                  opinion: articleMeta.opinion
                })
                .then(dbPost => {

                    return routeHelpers.initiatePost(source, dbPost)
                    .then(x => {
                      let tagProms = [];
                      if (articleMeta.tags !== null) {
                        articleMeta.tags.forEach(tag => {

                          tagProms.push(
                            db.Tag.findOrCreate({
                              where: {
                                text: tag
                              }
                            })
                            .spread( (dbTag, created) => {
                              return dbPost.addTags(dbTag);
                            })
                          )
                        })
                      }

                      return Promise.all(tagProms);
                    })
                })
                .catch(err => {
                  logger.error("Couldn't create post or add it to the initated posts of user. " + err);
                })
              })
              .catch(err => {
                logger.error("Couldn't retrieve the metadata of the article. " + JSON.stringify(err))
              })
            }
          })
          .catch(err => {
            logger.error("Sth went wrong with fetching the post from the db " + err);
          })
        }))
      })
      .then(() => {
        return Promise.resolve(feedChanged);
      })
    }
    else {
      return Promise.resolve(feedChanged);
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
