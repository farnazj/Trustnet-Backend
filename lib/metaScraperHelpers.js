require('../lib/metaScraperCustomRules')
const logger = require('../lib/logger');

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
  require('../lib/metaScraperCustomRules')()
])
const got = require('got');
const axios = require('axios');
// const url = require('url');

async function getArticleMetaData(articleUrl) {

  return new Promise( async (resolve, reject) => {
    try {
      const { body: html, url } = await got(articleUrl, {
        timeout: 800,
        retry: 1
      })
      const metadata = await metascraper({ html, url })
      resolve(metadata);
    }
    catch(err) {
      try {
        let axiosResp = await axios({ method: 'get', url: articleUrl})
        let html = axiosResp.data;
        let URL = typeof axiosResp.request.responseURL != 'undefined' ? axiosResp.request.responseURL : 
          axiosResp.config.url;
        const metadata = await metascraper({ html, URL, validateUrl: false });
        resolve(metadata);
      }
      catch(secondErr) {
        console.log('second error', secondErr)
        reject(new Error(`${secondErr} for ${articleUrl}`));
      }

    }

  })
}

module.exports = {
  getArticleMetaData
}
