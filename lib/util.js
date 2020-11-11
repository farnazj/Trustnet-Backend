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

function isValidUrl(string) {
  try {
    new URL(string);
  } catch (_) {
    return false;  
  }

  return true;
}

module.exports = {
  sanitize,
  isValidUrl
}
