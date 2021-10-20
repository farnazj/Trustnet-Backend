const cheerio = require('cheerio');
const { remove } = require('./logger');

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

// function extractHostname(url) {
//   var hostname;
//   //find & remove protocol (http, ftp, etc.) and get hostname

//   if (url.indexOf("//") > -1) {
//       hostname = url.split('/')[2];
//   }
//   else {
//       hostname = url.split('/')[0];
//   }

//   //find & remove port number
//   hostname = hostname.split(':')[0];
//   //find & remove "?"
//   hostname = hostname.split('?')[0];

//   return hostname;
// }

function extractHostname(url, removeProtocol) {
  let hostname = url;
  //find & remove protocol (http, ftp, etc.) and get hostname

  let keepQueryParam = false;
  if (['facebook.com/photo/?fbid', 'facebook.com/watch', 'youtube.com/watch'].some(el => 
    url.includes(el)))
    keepQueryParam = true;

  if (url.indexOf("//") != -1 ) {
    
    if (keepQueryParam)
      hostname = hostname.split('&')[0];
    else {
      let indexOfFirstParam = hostname.indexOf('?', hostname.indexOf("//") + 2);
      if (indexOfFirstParam != -1)
        hostname = hostname.substring(indexOfFirstParam);
    }
      
  }
  else {
    console.log('what kind of url is it', url);
  }

  if (removeProtocol)
    hostname = hostname.split('//')[1];    

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

function randomizer(values) {
  let i, pickedValue,
          randomNr = Math.random(),
          threshold = 0;

  for (i = 0; i < values.length; i++) {
      if (values[i].probability === '*') {
          continue;
      }

      threshold += values[i].probability;
      if (threshold > randomNr) {
              pickedValue = values[i].value;
              break;
      }

      if (!pickedValue) {
          //nothing found based on probability value, so pick element marked with wildcard
          pickedValue = values.filter((value) => value.probability === '*');
      }
  }

  return pickedValue;
}

module.exports = {
  sanitize,
  isValidUrl,
  extractHostname,
  hashCode,
  uncurlify,
  randomizer
}
