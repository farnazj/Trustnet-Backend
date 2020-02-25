var express = require('express');
var router = express.Router();
var Sequelize = require('sequelize');
var db  = require('../models');
var routeHelpers = require('../lib/routeHelpers');
var feedHelpers = require('../lib/feedHelpers');
var constants = require('../lib/constants');
var wrapAsync = require('../lib/wrappers').wrapAsync;
const logger = require('../lib/logger');

const Op = Sequelize.Op;
// var kue = require('kue')
//  , queue = kue.createQueue();

router.route('/feeds')

.post(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  let feed = await db.Feed.findOne({
    where: {
      rssfeed: req.body.rssfeed
    }
  })

  if (feed) {
    res.send({ message: 'Feed already exists'});
  }
  else {
    try {
      let meta = await feedHelpers.getFeed(req.body.rssfeed).then(feedHelpers.getFeedMeta);
      let feedProm = db.Feed.create({
        rssfeed: req.body.rssfeed,
        name: meta.title,
        description: meta.description,
        frequency: req.body.frequency
      });

      let entityPassword = await routeHelpers.generateHash(process.env.ADMIN_KEY);
      let image = Object.entries(meta.image).length === 0 ? null : meta.image.url;
      //TODO: fix image

      db.Source.findOrCreate({
        where: {
          userName: meta.title,
          photoUrl: image
        },
        defaults: {
          systemMade: true,
          passwordHash: entityPassword,
          email: null,
          isVerified: true
        }
      })
      .spread( async (source, created) => {

        // if (created)
        //   queue.create('addNode', {sourceId: source.id}).priority('high').save();

        let feed = await feedProm;
        await Promise.all[source.addSourceFeed(feed), feed.setFeedSource(source)];
        feedQueue.addFeed(feed);
      })

      res.send({ message: 'Feed has been added' });
    }
    catch(err) {
      logger.error('In adding feeds' + err);
      res.status(500).send({ message: 'Something went wrong with fetching the feed' });
    }

  }

}))

module.exports = router;
