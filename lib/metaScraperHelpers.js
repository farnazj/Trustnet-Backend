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
      console.log('error', err)
      reject(new Error(`${err} for ${articleUrl}`));
    }

  })
}

module.exports = {
  getArticleMetaData
}
