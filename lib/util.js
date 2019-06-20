const cheerio = require('cheerio');

function sanitize(html, imgUrl) {

  const $ = cheerio.load(html)
  $('img').addClass('article-inner-img');

  if (typeof imgUrl !== 'undefined') {
    let fileName = imgUrl.substring(imgUrl.lastIndexOf('/'), imgUrl.lastIndexOf('.'));
    //console.log("\n\n",fileName)
    $('img[src*=\"' + fileName + '\"]').remove();
  }

  return $.html();
}

module.exports = {
  sanitize
}
