/*
some title routes that depend on post id are in routes/posts.js
*/
var express = require('express');
var router = express.Router();
var Sequelize = require('sequelize');
var db  = require('../models');
var routeHelpers = require('../lib/routeHelpers');
var boostHelpers = require('../lib/boostHelpers');
var constants = require('../lib/constants');
var utils = require('../lib/util');
var wrapAsync = require('../lib/wrappers').wrapAsync;
const Op = Sequelize.Op;
const { v4: uuidv4 } = require('uuid');
// const AltTitlesRedisHandler = require('../lib/alternativeTitles');

router.route('/custom-title-endorsement/user/:set_id')

//returns whether the auth user has endorsed a custom title
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

//returns which sources have endorsed a title set (a title or any of its previous versions)
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

/*
route to find StandaloneTitles whose hashes match the hashes sent by the extension
*/
router.route('/custom-titles-match')
.post(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  let titleHashes = req.body.titlehashes;
  let customTitlesSetIds = [];
  let proms = titleHashes.map(titleHash => { 
    return altTitlesRedisHandler.getMatchingAltTitles(titleHash)
    .then(customTitleMatches => {
      customTitlesSetIds.push(...customTitleMatches);
    })
    
  });
  await Promise.all(proms);

  if (customTitlesSetIds.length) {

    let userPreferences = await db.Preferences.findOne({
      where: {
          SourceId: req.user.id
      }
    });
  
    let anySourceMode = (userPreferences && JSON.parse(userPreferences.preferencesBlob).headlineSources ===
      constants.HEADLINE_SOURCES_MODES.ANY) ? true : false;

    let whereClause = {};
  
    //if user's preferences are set such that they see headlines submitted by any source, not just the ones
    //they follow or trust
    if (anySourceMode) {
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
      }],
      order: [
        [ 'StandaloneCustomTitles', 'setId', 'DESC'],
        [ 'StandaloneCustomTitles', 'version', 'DESC']
      ]
    })

    res.send(standaloneTitles);
  }
  else {
    res.send([])
  }

}))

/*
edit a title by posting a new version of it
*/
router.route('/custom-titles/:standalone_title_id/:set_id')
.post(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  let standaloneTitle = (await db.StandaloneTitle.findAll({
    where: {
      [Op.and]: [{
        id: req.params.standalone_title_id
      }, {
        '$StandaloneCustomTitles.setId$': req.params.set_id
      }, {
        '$StandaloneCustomTitles.sourceId$': req.user.id
      }]
    },
    include: [{
      model: db.CustomTitle,
      as: 'StandaloneCustomTitles'
    }],
    order: [
      ['StandaloneCustomTitles', 'version', 'DESC']
    ]
  }))[0];

  let customTitles = standaloneTitle.StandaloneCustomTitles;

  if (customTitles.length) {

    let updateProms = [];
    let endorsers = [];

    for (let title of customTitles) {
      if (title.version == 1)
        endorsers = await title.getEndorsers();

      updateProms.push(title.update({ version: title.version - 1}));
      updateProms.push(title.removeEndorsers());
    }
    let authUserProm = db.Source.findByPk(req.user.id);
    let customTitleSpecs = req.body;
    customTitleSpecs.setId = req.params.set_id;
    let customTitleProm = db.CustomTitle.create(customTitleSpecs);

    let [authUser, customTitle] = await Promise.all([authUserProm, customTitleProm]);
    

    let sourceTitleProm = authUser.addSourceCustomTitles(customTitle);
    let standaloneCustomTitleAssocProm = standaloneTitle.addStandaloneCustomTitles(customTitle);
    let addEndorsers = customTitle.addEndorsers(endorsers);

    await Promise.all([sourceTitleProm, standaloneCustomTitleAssocProm, addEndorsers, ...updateProms]);
    customTitle.save();

    res.send({ message: 'Title updated' });
  }
  else {
    res.send({ message: 'Title does not exist' })
  }

}))


.delete(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  let standaloneTitle = (await db.StandaloneTitle.findAll({
    where: {
      [Op.and]: [{
        id: req.params.standalone_title_id
      }, {
        '$StandaloneCustomTitles.setId$': req.params.set_id
      }, {
        '$StandaloneCustomTitles.sourceId$': req.user.id
      }]
    },
    include: [{
      model: db.CustomTitle,
      as: 'StandaloneCustomTitles'
    }],
    order: [
      ['StandaloneCustomTitles', 'version', 'DESC']
    ]
  }))[0];

  let customTitlesToDelete = standaloneTitle.StandaloneCustomTitles;


  if (customTitlesToDelete.length) {
    await altTitlesRedisHandler.deleteAltTitles(customTitlesToDelete, standaloneTitle);
    let deleteProms = customTitlesToDelete.map(customTitle => {
      return customTitle.destroy();
    });

    await Promise.all(deleteProms);
    res.send({ message: 'Title deleted' });
  }
  else {
    res.send({ message: 'Title does not exist' })
  }

}));

/*
get the custom titles associated with a standaloneTitle from the auth user's perspective
*/
router.route('/custom-titles/:standalone_title_id')
.get(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  let userPreferences = await db.Preferences.findOne({
    where: {
        SourceId: req.user.id
    }
  });

  let anySourceMode = (userPreferences && JSON.parse(userPreferences.preferencesBlob).headlineSources ===
      constants.HEADLINE_SOURCES_MODES.ANY) ? true : false;

  let whereConfig = {}

  if (anySourceMode) {
    whereConfig = {
      id: req.params.standalone_title_id
    }
  }
  else {
    let relations = await boostHelpers.getBoostersandCredSources(req);
    let titleSources = relations.followedTrusteds;

    if (req.headers.activityusername) {
      let activityUser = await db.Source.findOne({
        where: {
          userName: req.headers.activityusername
        }
      });
  
      titleSources.push(activityUser.id)
    }

    whereConfig = {
      [Op.and]: [{
        id: req.params.standalone_title_id
      }, {
        '$StandaloneCustomTitles.SourceId$': {
          [Op.in]: titleSources
        },
      }]
    }
  }


  let standaloneTitles = await db.StandaloneTitle.findAll({
    where: whereConfig,
    include: [{
      model: db.CustomTitle,
      as: 'StandaloneCustomTitles',
      include: [{
        model: db.Source,
        as: 'Endorsers',
      }]
      
    }],
    order: [
      [ 'StandaloneCustomTitles', 'setId', 'DESC'],
      [ 'StandaloneCustomTitles', 'version', 'DESC']
    ]
  })
  
  let results = standaloneTitles.length ? standaloneTitles[0] : {};

  res.send(results);
}));


/*
Create a new custom title ---This route is for articles that do not have an associated article yet.
req.body: postId, postUrl, customTitleText, pageIndentifiedTitle, appRequest (used to differentiate between
  the request being sent from the webapp or the extension -- in the webapp, there is no need to send the
  pageIdentifiedTitle)
*/
router.route('/custom-titles')

.post(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  let postProm = new Promise(() => { return null; });
  if (req.body.postId) {
    postProm = db.Post.findByPk(req.body.postId);
  }
  else {
    try {
      //if the article does not conform to ogp and can't be imported using its url,
      //a post will simply be created which holds the posted url
      await routeHelpers.importPost(req.body.postUrl);

      postProm = db.Post.findOne({
        where: { url: req.body.postUrl }
      });  
    }
    catch(err) {
      console.log(err);
    }
    
  }

  let authUserProm = db.Source.findByPk(req.user.id);
  
  let customTitleSpecs = { text: req.body.customTitleText };
  customTitleSpecs.setId = uuidv4();
  let customTitleProm = db.CustomTitle.create(customTitleSpecs);

  let [post, authUser, customTitle] = await Promise.all([postProm, authUserProm, customTitleProm]);

  let titleToHash = (req.body.appRequest && post) ? post.title : req.body.pageIndentifiedTitle;

  let dbResp = await db.StandaloneTitle.findOrCreate({
    where: {
      text: titleToHash, 
      hash: utils.hashCode(utils.uncurlify(titleToHash.substr(0, constants.LENGTH_TO_HASH)).toLowerCase())
    }
  });

  let standaloneTitle = dbResp[0];

  let standaloneCustomTitleAssocProm = standaloneTitle.addStandaloneCustomTitles(customTitle);
  let sourceTitleProm = authUser.addSourceCustomTitles(customTitle);

  let postTitleProm = post ? post.setStandaloneTitle(standaloneTitle) : new Promise((resolve) => { resolve(); });

  let redisHandlerProm = altTitlesRedisHandler.addAltTitle(customTitle, standaloneTitle);

  await Promise.all([sourceTitleProm, standaloneCustomTitleAssocProm, postTitleProm, redisHandlerProm]);
  res.send({ message: 'Title posted', data: standaloneTitle });

}));


module.exports = router;

