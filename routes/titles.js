/*
some title routes that depend on post id are in routes/posts.js
*/
var express = require('express');
var router = express.Router();
var Sequelize = require('sequelize');
var moment = require('moment');
var db  = require('../models');
var routeHelpers = require('../lib/routeHelpers');
var boostHelpers = require('../lib/boostHelpers');
var constants = require('../lib/constants');
var wrapAsync = require('../lib/wrappers').wrapAsync;
const Op = Sequelize.Op;
const { v4: uuidv4 } = require('uuid');
const AltTitlesRedisHandler = require('../lib/alternativeTitles');

router.route('/custom-title-endorsement/user/:set_id')

//if auth user has endorsed a custom title
.get(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  let title = await db.CustomTitle.findOne({
    include: [{
      model: db.Source,
      as: 'Endorsers',
      where: {
        id: req.user.id
      }
    }],
    where: {
      setId: req.params.set_id,
      version: 1
    }
  });

  let result = title ? true : false;

  res.send(result);
}))


.post(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  let authUserProm = db.Source.findByPk(req.user.id);
  let titleProm = db.CustomTitle.findOne({
    where: {
      setId: req.params.set_id,
      version: 1
    }
  });

  let [authUser, title] = await Promise.all([authUserProm, titleProm]);
  if (req.body.endorse_status == true)
    await title.addEndorser(authUser);
  else
    await title.removeEndorser(authUser);

  res.send({ message: 'Endorsement value changed' });
}));


router.route('/custom-title-endorsement/:set_id')

.get(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  let relations = await boostHelpers.getBoostersandCredSources(req);
  let titleSources = relations.followedTrusteds.concat(post.SourceId);

  let title = await db.CustomTitle.findOne({
    include: [{
      model: db.Source,
      as: 'Endorsers',
      where: {
        SourceId: {
          [Op.in]: titleSources
        }
      }
    }],
    where: {
      setId: req.params.set_id
    }
  });

  res.send(title.Endorsers);
}));


router.route('/custom-titles-match')
.post(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  let titleHashes = req.body.titlehashes;
  let customTitlesSetIds = [];
  let proms = titleHashes.map(titleHash => { 
    console.log(titleHash, altTitlesRedisHandler.getMatchingAltTitles(titleHash))
    return altTitlesRedisHandler.getMatchingAltTitles(titleHash)
    .then(customTitleMatches => {
      console.log(customTitleMatches, '&&&&&&');
      customTitlesSetIds.push(...customTitleMatches);
    })
    
  });
  await Promise.all(proms);
  console.log(customTitlesSetIds, '******')

  if (customTitlesSetIds.length) {

    let majorityMode = req.headers.majoritymode == 'true' ? true : false;

    let whereClause = {};
  
    if (majorityMode) {
      whereClause = {
        '$StandaloneCustomTitles.setId$': {
          [Op.in]: customTitlesSetIds
        }
      }
    }
    else {
      let relations = await boostHelpers.getBoostersandCredSources(req);
      let titleSources = relations.followedTrusteds; //includes auth user id as well
  
      whereClause = {
        [Op.and]: [{
          '$StandaloneCustomTitles.setId$': {
            [Op.in]: customTitlesSetIds
          }
        }, {
          '$StandaloneCustomTitles.SourceId$': {
            [Op.in]: titleSources
          }
        }]
      }
    }
  
    let standaloneTitles = await db.StandaloneTitle.findAll({
      where: whereClause,
      include: [{
        model: db.CustomTitle,
        as: 'StandaloneCustomTitles',
        include: [{
          model: db.Source,
          as: 'Endorsers',
        }]
      }]
    })
  
    res.send(standaloneTitles);
  }
  else {
    res.send([])
  }

}))


module.exports = router;

