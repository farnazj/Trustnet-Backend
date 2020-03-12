const metascraper = require('metascraper')([
  require('metascraper-author')(),
  require('metascraper-date')(),
  require('metascraper-description')(),
  require('metascraper-image')(),
  require('metascraper-logo')(),
  require('metascraper-clearbit')(),
  require('metascraper-publisher')(),
  require('metascraper-title')(),
  require('metascraper-url')()
])
const got = require('got');

async function getArticleMetaData(articleUrl) {

  return new Promise( async (resolve, reject) => {
    try {
      const { body: html, url } = await got(articleUrl)
      const metadata = await metascraper({ html, url })
      resolve(metadata);
    }
    catch(err) {
      reject(new Error(`${err} for ${articleUrl}`));
    }

  })
}

module.exports = {
  getArticleMetaData
}
