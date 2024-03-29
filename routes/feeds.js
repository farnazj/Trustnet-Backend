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
    },
    include: [{
      model: db.Source,
      as: 'FeedSource'
    }]
  })

  if (feed) {
    res.send({ message: 'Feed already exists', source: feed.FeedSource });
  }
  else {
    try {
      let meta = await feedHelpers.getFeed(req.body.rssfeed).then(feedHelpers.getFeedMeta);
      let feedProm = db.Feed.create({
        rssfeed: req.body.rssfeed,
        name: meta.title,
        description: meta.description,
        priority: Number.MAX_SAFE_INTEGER,
        updateRate: 0,
        lastFetched: null
      });

      let entityPassword = await routeHelpers.generateHash(process.env.ADMIN_KEY);
      let image = Object.entries(meta.image).length === 0 ? null : meta.image.url;
      //TODO: fix image

      db.Source.findOrCreate({
        where: {
          userName: meta.title
        },
        defaults: {
          systemMade: true,
          passwordHash: entityPassword,
          email: null,
          isVerified: true
        }
      })
      .then( async ([source, created]) => {

        if (!source.photoUrl && image) {
          source.update({ photoUrl: image});
        }

        if (created || (!source.description && meta.description))
          source.update({ description: meta.description });
        // if (created)
        //   queue.create('addNode', {sourceId: source.id}).priority('high').save();

        let feed = await feedProm;
        await Promise.all([source.addSourceFeed(feed), feed.setFeedSource(source)]);
        feedQueue.addFeed(feed);
        res.send({ message: 'Feed is added', source: source });
      })

    }
    catch(err) {
      logger.error('In adding feeds' + err);
      res.status(500).send({ message: 'Something went wrong with fetching the feed' });
    }

  }

}))

module.exports = router;
