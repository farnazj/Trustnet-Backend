const logger = require('../lib/logger');
var constants = require('../lib/constants');

function filterValidity(posts, req) {
  if (req.headers.validity == constants.VALIDITY_TYPES.CONFIRMED) {
    return posts.filter(post => post.PostAssessments.every(function(assess){return assess.postCredibility == 2 }));
  }
  else if (req.headers.validity == constants.VALIDITY_TYPES.REFUTED) {
    return posts.filter(post => post.PostAssessments.every(function(assess){return assess.postCredibility == 0 }));
  }
  else if (req.headers.validity == constants.VALIDITY_TYPES.DEBATED) {
    return posts.filter(post => post.PostAssessments.some(function(assess){return assess.postCredibility == 0 }) &&
    post.PostAssessments.some(function(assess){return assess.postCredibility == 2 }) );
  }
  else
    return posts;
}

module.exports = filterValidity;
