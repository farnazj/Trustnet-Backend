const ogs = require('open-graph-scraper');
const logger = require('../lib/logger');

async function getOGPArticle(article){

  return new Promise((resolve, reject) => {
    
    ogs({
      'url':article,
      'timeout': 5000
    })
    .then(function (result) {
      resolve(result);
    })
    .catch(function (error) {
      logger.error('in getting OGP ' + error + article)
      reject(new Error(`${error} for ${article}`));
    });
  })

}

module.exports = {
  getOGPArticle
}
