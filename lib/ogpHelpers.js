const ogs = require('open-graph-scraper');

async function getOGPArticle(article){

  return new Promise((resolve, reject) => {
    ogs({'url':article})
    .then(function (result) {
      resolve(result);
    })
    .catch(function (error) {
      console.log('error khord', error, article)
      reject(new Error(`${error} for ${article}`));
    });
  })

}

module.exports = {
  getOGPArticle
}
