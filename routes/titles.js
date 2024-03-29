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
var util = require('../lib/util');
var wrapAsync = require('../lib/wrappers').wrapAsync;
const Op = Sequelize.Op;
const { v4: uuidv4 } = require('uuid');
const logger = require('../lib/logger');
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

    let authUserProm = db.Source.findByPk(req.user.id);
  
    let standaloneTitles = await db.StandaloneTitle.findAll({
      where: whereClause,
      include: [{
        model: db.CustomTitle,
        as: 'StandaloneCustomTitles',
        include: [{
          model: db.Source,
          as: 'Endorsers',
        }]
      }, {
        model: db.Post,
      }],
      order: [
        [ 'StandaloneCustomTitles', 'setId', 'DESC'],
        [ 'StandaloneCustomTitles', 'version', 'DESC']
      ]
    });

    let authUser = await authUserProm;
    
    let withholdProbs = [ { value: false, probability: 1- constants.ALT_HEADLINE_WITHHOLD_PROBABILITY},
      { value: true, probability: constants.ALT_HEADLINE_WITHHOLD_PROBABILITY }];

    let headlineStatuses = [];

    let statusProms = standaloneTitles.map(standaloneTitle => {
      return db.HeadlineStatus.findOrCreate({
        where: {
          [Op.and]: [{
            SourceId: req.user.id
          }, {
            standaloneTitleId: standaloneTitle.id
          }]
        }
      }).then((results) => {

        headlineStatuses.push(results[0]);

        if (results[1]) { //if the status instance has just been created

          let withheldVal;

          /*
          If any of the custom titles has been created by the user, it means that the user has seen the alt title
          before (e.g., in the feed or by initiating the posting of title on a headline that doesn't have any alt
          titles yet), and therefore they should not be withheld from the user.
          */
          if (standaloneTitle.StandaloneCustomTitles.some((customTitle) => customTitle.SourceId == req.user.id ))
            withheldVal = false;
          else
            withheldVal= util.randomizer(withholdProbs)

          results[0].isWithheld = withheldVal;
          return Promise.all([
            results[0].setSource(authUser),
            results[0].setStandaloneTitle(standaloneTitle),
            results[0].save()
          ]);
        }
        else
          return new Promise((resolve) => resolve());
  
      })

    })
    
    await Promise.all(statusProms);
    res.send({ titles: standaloneTitles, statuses: headlineStatuses });
  }
  else {
    res.send({ titles: [], statuses: [] });
  }

}))


router.route('/custom-titles/headline-status/:standalone_title_id')
.post(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  try {
    await db.HeadlineStatus.update({
      isEncountered: req.body.isEncountered
    }, {
      where: {
        [Op.and]: [{
          SourceId: req.user.id
        }, {
          standaloneTitleId: req.params.standalone_title_id
        }]
      }
    });
    res.send({ message: 'Headline status updated' });
  }
  catch (err) {
    console.log(err);
    logger.error(`Error in updating headline status: ${err}`);
    res.status(403).send({ message: 'Error in updating headline status' });
  }
   
}));


/*
edit a title by posting a new version of it
*/
router.route('/custom-titles/:set_id')
.post(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  let earlierCustomTitles = await db.CustomTitle.findAll({
    where: {
      [Op.and]: [{
        setId: req.params.set_id
      }, {
        sourceId: req.user.id
      }]
    },
    include: [{
      model: db.StandaloneTitle,
      as: 'parentOriginalTitle'
    }],
    order: [
      ['version', 'DESC']
    ]
  });

  if (earlierCustomTitles.length) {

    let updateProms = [];
    let endorsers = [];

    for (let customTitle of earlierCustomTitles) {
      if (customTitle.version == 1)
        endorsers = await customTitle.getEndorsers();

      updateProms.push(customTitle.update({ version: customTitle.version - 1}));
      updateProms.push(customTitle.removeEndorsers());
    }

    let authUserProm = db.Source.findByPk(req.user.id);
    let customTitleSpecs = req.body;
    customTitleSpecs.setId = req.params.set_id;
    let customTitleProm = db.CustomTitle.create(customTitleSpecs);

    let [authUser, newCustomTitle] = await Promise.all([authUserProm, customTitleProm]);

    let associatedStandaloneTitles = earlierCustomTitles.map(earlierCustomTitle => earlierCustomTitle.parentOriginalTitle).flat();
    let uniqueAssociatedStandaloneTitleIds = [];
    let standaloneCustomTitleAssocProms = [];

    for (let standaloneTitle of associatedStandaloneTitles) {
      if (!uniqueAssociatedStandaloneTitleIds.includes(standaloneTitle.id)) {
        uniqueAssociatedStandaloneTitleIds.push(standaloneTitle.id);
        standaloneCustomTitleAssocProms.push(standaloneTitle.addStandaloneCustomTitles(newCustomTitle));
      }
    }
    
    let sourceTitleProm = authUser.addSourceCustomTitles(newCustomTitle);
    let addEndorsers = newCustomTitle.addEndorsers(endorsers);

    await Promise.all([sourceTitleProm, ...standaloneCustomTitleAssocProms, addEndorsers, ...updateProms]);
    newCustomTitle.save();

    res.send({ message: 'Title updated' });
  }
  else {
    res.send({ message: 'Title does not exist' })
  }

}))


.delete(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {


  let customTitlesToDelete = await db.CustomTitle.findAll({
    where: {
      [Op.and]: [{
        setId: req.params.set_id
      }, {
        sourceId: req.user.id
      }]
    },
    include: [{
      model: db.StandaloneTitle,
      as: 'parentOriginalTitle'
    }],
    order: [
      ['version', 'DESC']
    ]
  });

  if (customTitlesToDelete.length) {
    await altTitlesRedisHandler.deleteAltTitles(customTitlesToDelete);
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
router.route('/custom-titles/original-title/:standalone_title_id')
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

  // let customTitles = await db.CustomTitle.findall({
  //   where : {
  //     [Op.and]: [{
  //       sourceId: {
  //         [Op.in]: titleSources
  //       }
  //     }, {
  //       '$parentOriginalTitle.id$': req.params.standalone_title_id
  //     }]
  //   },
  //   include: [{
  //     model: db.StandaloneCustomTitle,
  //     as: 'parentOriginalTitle'
  //   }, {
  //     model: db.Source,
  //     as: 'Endorsers'
  //   }],
  //   order: [
  //     [],
  //     []
  //   ]
  // })

  let standaloneTitles = await db.StandaloneTitle.findAll({
    where: whereConfig,
    include: [{
      model: db.CustomTitle,
      as: 'StandaloneCustomTitles',
      through: {
        attributes: []
      },
      include: [{
        model: db.Source,
        as: 'Endorsers',
      }
    ]  
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
req.body: postId, postUrl, customTitleText, pageIdentifiedTitles, appRequest (used to differentiate between
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
        where: { url: util.extractHostname(req.body.postUrl) }
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

  let titlesToHash = [];
  if (req.body.appRequest && post)
    titlesToHash = [post.title];
  else
    titlesToHash = req.body.pageIdentifiedTitles;

  let dbRespProms = [];
  for (let titleToHash of titlesToHash) {
    dbRespProms.push(db.StandaloneTitle.findOrCreate({
      where: {
        text: titleToHash, 
        hash: util.hashCode(util.uncurlify(titleToHash.substr(0, constants.LENGTH_TO_HASH)).toLowerCase())
      }
    }))
  }
  
  let standaloneTitles = (await Promise.all(dbRespProms)).map(dbResp => dbResp[0]);
  let standaloneCustomTitleAssocProms = [], postTitleProms = [], redisHandlerProms = [];
  
  for (let standaloneTitle of standaloneTitles) {
    standaloneCustomTitleAssocProms.push(standaloneTitle.addStandaloneCustomTitles(customTitle));
    postTitleProms.push(post ? post.addPostStandAloneTitles(standaloneTitle) : new Promise((resolve) => { resolve(); }));
    redisHandlerProms.push(altTitlesRedisHandler.addAltTitle(customTitle, standaloneTitle));
  }

  let sourceTitleProm = authUser.addSourceCustomTitles(customTitle);  

  await Promise.all([sourceTitleProm, ...standaloneCustomTitleAssocProms,
     ...postTitleProms, ...redisHandlerProms]);
  res.send({ message: 'Title posted', data: standaloneTitles });

}));


module.exports = router;

