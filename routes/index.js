var models = require('../models');
var express = require('express');
var routeHelpers = require('../helpers/routeHelpers');
var feedHelpers = require('../helpers/feedHelpers');

var router = express.Router();



router.get('/', routeHelpers.isLoggedIn, async function(req, res, next) {

    let auth_user = await models.Source.findById(req.user.id);

    let followees = await auth_user.getFollows();
    let feeds_proms = [];
    followees.map(source => feeds_proms.push(source.getSourceFeeds()));

    let followed_feeds = await Promise.all(feeds_proms); //an array of (array) feeds of each source

    let feeds_flattened = followed_feeds.reduce( function(accumulator, currentValue) {
      return accumulator.concat(currentValue);
    },[]);

    let source_ids = [];
    for (let i = 0 ; i < followed_feeds.length ; i++)
      for (let j = 0 ; j < followed_feeds[i].length ; j++)
        source_ids.push(followees[i].id);

    await feedHelpers.updateRSSPosts(feeds_flattened, source_ids);
    res.redirect('/posts/boosts');

});

module.exports = router;
