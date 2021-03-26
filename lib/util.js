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

function extractHostname(url) {
  var hostname;
  //find & remove protocol (http, ftp, etc.) and get hostname

  if (url.indexOf("//") > -1) {
      hostname = url.split('/')[2];
  }
  else {
      hostname = url.split('/')[0];
  }

  //find & remove port number
  hostname = hostname.split(':')[0];
  //find & remove "?"
  hostname = hostname.split('?')[0];

  return hostname;
}

function hashCode(s) {
  return s.split("").reduce(function(a,b) {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a&a },
    0);              
}

/*
changes curly quotes to their non-curly counterparts
*/
function uncurlify(s) {
  return s
  .replace(/[\u2018\u2019]/g, "'")
  .replace(/[\u201C\u201D]/g, '"');
}

module.exports = {
  sanitize,
  isValidUrl,
  extractHostname,
  hashCode,
  uncurlify
}
