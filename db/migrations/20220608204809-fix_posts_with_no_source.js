'use strict';
var Sequelize = require('sequelize');
const Op = Sequelize.Op;

var db = require('../../models');
const logger = require('../../lib/logger');
require('../../lib/metaScraperCustomRules')

const metascraper = require('metascraper')([
  require('metascraper-author')(),
  require('metascraper-date')(),
  require('metascraper-description')(),
  require('metascraper-image')(),
  require('metascraper-logo')(),
  require('metascraper-clearbit')(),
  require('metascraper-publisher')(),
  require('metascraper-title')(),
  require('metascraper-url')(),
  require('../../lib/metaScraperCustomRules')()
])

const axios = require('axios');
const psl = require('psl');
var util = require('../../lib/util');
var routeHelpers = require('../../lib/routeHelpers');
var constants = require('../../lib/constants');
var moment = require('moment');


async function getArticleMetaData(articleUrl) {
  return new Promise( async (resolve, reject) => {

      try {
        let axiosResp = await axios({ method: 'get', url: articleUrl})
        let html = axiosResp.data;
        let URL = typeof axiosResp.request.responseURL != 'undefined' ? axiosResp.request.responseURL : 
          axiosResp.config.url;
        const metadata = await metascraper({ html, URL, validateUrl: false });
        resolve(metadata);
      }
      catch(err) {
        console.log('error', err)
        reject(new Error(`${err} for ${articleUrl}`));
      }
  })
}


async function associatePostWSource(articleMetaData, post) {

  try {
    if (articleMetaData && articleMetaData.publisher) {
   
      let updateValues = {};
      if (articleMetaData.title)
        updateValues.title = articleMetaData.title.trim();
      if (articleMetaData.description) {
        updateValues.description = articleMetaData.description.trim();
        updateValues.body = articleMetaData.description.trim();
      }
      if (articleMetaData.image)
        updateValues.image = articleMetaData.image;
      if (articleMetaData.author)
        updateValues.author = articleMetaData.author;
  
      await post.update({
       ...updateValues,
        publishedDate: articleMetaData.date ? articleMetaData.date : moment.utc()
      });
  
      let postProm = post.save();
  
      let feed = await db.Feed.findOne({
        where: {
          name: articleMetaData.publisher
        }
      });
  
      let articleSource, created;
  
      if (feed) {
  
        /*
        if the domain name of the post matches the URL of the feed that is found with the same publisher name
        as the post, the Source of the post should be set as the Source associated with the feed found.
        */
        if (psl.get(util.extractHostname(feed.rssfeed, true)) == psl.get(util.extractHostname(post.url, true))) {
          articleSource = await db.Source.findByPk(feed.SourceId);
        }
        else {
          let results = await routeHelpers.findOrCreateSource(articleMetaData.publisher);
          articleSource = results[0];
          created = results[1];
        }
  
      }
      else { //no feed is found with the same publisher name as the post. Create a new Source.
        let results = await routeHelpers.findOrCreateSource(articleMetaData.publisher);
        articleSource = results[0];
        created = results[1];
      }
  
      if (!articleSource.photoUrl)
        articleSource.update({ photoUrl: articleMetaData.logo });
  
      let articleSourceAssessment = await db.Assessment.create({
        postCredibility: constants.ACCURACY_CODES.CONFIRMED,
        isTransitive: false,
        sourceIsAnonymous: false
      })
  
      await Promise.all([
        articleSource.addInitiatedPost(post),
        routeHelpers.handleBoostPostRelations(articleSource, post, true),
        post.addPostAssessment(articleSourceAssessment),
        articleSource.addSourceAssessment(articleSourceAssessment),
        postProm
      ]);
  
    }
    else {
      console.log('article metadata was not found')
    }
  }
  catch(err) {
    console.log('error occured', err);
    reject(new Error(`${err} in associating posts with sources for ${post.url}`));

  }
  
}

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return new Promise(async (resolve, reject) => {
      try {
        let postsWOSource = await db.Post.findAll ({
          where: {
            [Op.and]: {
              SourceId: {
                [Op.eq]: null
              },
              title: {
                [Op.eq]: null
              }
            }
            
          }
        })

        let proms = postsWOSource.map(post => {
          return getArticleMetaData(post.url)
          .then(metadata => {
            return associatePostWSource(metadata, post);
          })
          .catch(err => {})
        })

        await Promise.allSettled(proms);
        resolve();
      }
      catch (err) {
        console.log(err)
        logger.error(err);
        reject();
      }     

    })

  },

  down: async (queryInterface, Sequelize) => {
    return new Promise(async (resolve, reject) => {
      try {
        resolve();
      }
      catch (err) {
        console.log(err)
        logger.error(err);
        reject();
      }
    })
  }
};
