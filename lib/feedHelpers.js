const ogs = require('open-graph-scraper');
const FeedParser = require('feedparser');
const axios = require('axios');
var moment = require('moment');
var db = require('../models');
var routeHelpers = require('./routeHelpers');


async function getFeed(feed) {

  return new Promise(async (resolve, reject)=>{
    try{
      if (!feed.lastUpdated || (Date.now() - feed.lastUpdated)/3600*1000 > 2) {

        let head_response = await axios({
          method:'head',
          url: feed.rssfeed
        });

        if (!feed.lastUpdated || moment(head_response.headers['last-modified']).isAfter(feed.lastUpdated)){
          const res = await axios({
            method:'get',
            url: feed.rssfeed,
            responseType:'stream'
          });

          const feedparser = new FeedParser();
          resolve([res.data.pipe(feedparser), feedparser]);
        }

      }
  }
  catch(err){
    reject(new Error(`something went wrong in fetching the feed ${err}`));
  }
    reject(new Error(`feed not changed`));
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


async function getOGPArticle(article){

  return new Promise((resolve, reject) => {
    ogs({'url':article})
    .then(function (result) {
      resolve(result);

    })
    .catch(function (error) {
      reject(new Error(`Couldn't retrieve ogp of article ${error}`));
    });
  })

}


async function updateRSSPosts(sources){

  return Promise.all(sources.map(source => {
    return Promise.all(source.SourceFeeds.map( feed => {
      return getFeed(feed)
      .then(readFeedStream)
      .then(articles_in_feed =>{
        return Promise.all(articles_in_feed.map(article => {

          return db.Post.findOne({where: {url: article.link}}).then(post =>{
            if (!post){
              return getOGPArticle(article.link).then(article_ogp =>{

                return db.Post.create({
                  title: article_ogp.data.ogTitle,
                  description: article_ogp.data.ogDescription,
                  url: article_ogp.data.ogUrl,
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
      }).catch(err =>{
        console.log("Sth went wrong with fetching the feed", err)
      })
    })
    )
  })
  );

}

module.exports = {
  updateRSSPosts
}
