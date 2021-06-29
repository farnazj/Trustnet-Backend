const logger = require('../lib/logger');
var constants = require('../lib/constants');

function filterAccuracy(posts, req) {
  if (req.headers.accuracy == constants.ACCURACY_TYPES.CONFIRMED) {
    return posts.filter(post => post.PostAssessments.every(function(assess){
      return assess.postCredibility == constants.ACCURACY_CODES.CONFIRMED }));
  }
  else if (req.headers.accuracy == constants.ACCURACY_TYPES.REFUTED) {
    return posts.filter(post => post.PostAssessments.every(function(assess){
      return assess.postCredibility == constants.ACCURACY_CODES.REFUTED }));
  }
  else if (req.headers.accuracy == constants.ACCURACY_TYPES.DEBATED) {
    return posts.filter(post => post.PostAssessments.some(function(assess){
      return assess.postCredibility == constants.ACCURACY_CODES.REFUTED }) &&
    post.PostAssessments.some(function(assess){
      return assess.postCredibility == constants.ACCURACY_CODES.CONFIRMED }) );
  }
  else
    return posts;
}

module.exports = filterAccuracy;
