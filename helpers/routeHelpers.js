var models  = require('../models');

function getSpecifictions(req_fields){

  let specifications = {};
  for (let key of Object.keys(req_fields)){
    specifications[key] = req_fields[key];
  }
  return specifications
}


function isLoggedIn(req, res, next) {

    // if user is authenticated in the session, carry on
    if (req.isAuthenticated())
        return next();

    // if they aren't redirect them to the home page
    res.redirect('/');
}


async function initiatePost(source, post){
  let assessment = await models.Assessment.create({postCredibility: 1});
  let initiates_post = source.addInitiatedPost(post);
  let boosts = source.addPostBoost(post);
  let post_assessment = post.addPostAssessment(assessment);
  let source_assessment = source.addSourceAssessment(assessment);


  return Promise.all([initiates_post, boosts, post_assessment, source_assessment]);

}

module.exports = {
  isLoggedIn: isLoggedIn,
	getSpecifictions: getSpecifictions,
  initiatePost: initiatePost
};
