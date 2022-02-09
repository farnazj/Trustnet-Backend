var Sequelize = require('sequelize');
const Op = Sequelize.Op;
var db  = require('../models');
var constants = require('../lib/constants');
const logger = require('../lib/logger');
var util = require('../lib/util');
const got = require('got');
var moment = require('moment');
const parse = require('node-html-parser').parse;

async function followLinkMappings(urls, timeout, retryCount) {

    let gotProms = [];
    let urlMapping = {};
  
    urls.forEach(sentUrl => {
  
      gotProms.push(
        got(sentUrl, {
        timeout: timeout,
        retry: retryCount,
        followRedirect: true
        })
        .then((response) => {
  
          let targetUrl;
          try {
            let dom = parse(response.body);
            let meta = dom.querySelector('meta[property="og:url"]');
            targetUrl = meta.getAttribute('content')
          }
          catch(err) {
            targetUrl = response.url;
          }
          urlMapping[util.extractHostname(targetUrl)] = sentUrl;
  
        })
        .catch((err) => {
          console.log('fetching sentUrl encounterd an error', sentUrl, err)
        })
      )
      
    })
  
    await Promise.allSettled(gotProms);
  
    return urlMapping;
}


async function storeURLMappings(urlMappings) {

    let transformedURLMappings = [];
    let currentTime = moment();
  
    Object.entries(urlMappings).forEach(([key, val]) => {
      transformedURLMappings.push({ originURL: key, targetURL: transformedVal});

      db.URLRedirection.create({
        originURL: key,
        targetURL: val,
        lastAccessTime: currentTime
      })
    });
  
    if (transformedURLMappings.length)
      await urlMappingsRedisHandler.addMappings(transformedURLMappings);
}

module.exports = {
    storeURLMappings,
    followLinkMappings
  }