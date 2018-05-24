var db = require('../models');
var express = require('express');
var routeHelpers = require('../helpers/routeHelpers');
var feedHelpers = require('../helpers/feedHelpers');

var router = express.Router();



router.get('/', routeHelpers.isLoggedIn, async function(req, res, next) {

    let auth_user = await db.Source.findById(req.user.id);

    let auth_user_ = await db.Source.findOne({
      where: {
        id: req.user.id
      },
      include: [{
        model: db.Source,
        as: 'Follows',
        include: [{
          model: db.Feed,
          as: 'SourceFeeds'
        }]
      },
      {
        model: db.Source,
        as: 'Mutes'
      },
      {
        model: db.Source,
        as: 'Trusteds'
      }
      ]
    });

    let unmuted_boosters = auth_user_.Follows.filter(source => (!auth_user_.Mutes.map(muted_source => {return muted_source.id}).includes(source.id) ));


    await feedHelpers.updateRSSPosts(unmuted_boosters);
    res.redirect('/posts/boosts');
});

module.exports = router;
