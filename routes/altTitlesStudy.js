var express = require('express');
var router = express.Router();
var Sequelize = require('sequelize');
var db  = require('../models');
var routeHelpers = require('../lib/routeHelpers');
var wrapAsync = require('../lib/wrappers').wrapAsync;
var constants = require('../lib/constants');
var logger = require('../lib/logger');
const Op = Sequelize.Op;


router.route('/alt-titles-feed')

.get(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

    let authUser = await db.Source.findOne({
        where: {
            id: req.user.id
        },
        include: [{
            model: db.Source,
            as: 'Follows'
        }]
    });

    let followedIds = authUser.Follows.map(source => source.id);
    followedIds.push(authUser.id)

    let posts = await db.Post.findAll({
        where: {
            '$StandaloneTitle->StandaloneCustomTitles.SourceId$': {
                [Op.in]: followedIds
            }
        },
        include: [{
            model: db.StandaloneTitle,
            include: [{
                model: db.CustomTitle,
                as: 'StandaloneCustomTitles',
                include: [{
                    model: db.Source,
                    as: 'Endorsers',
                }]
            }]
        }],
        limit: req.params.limit,
        offset: req.params.offset,
        order: [
            [ 'publishedDate', 'DESC'],
            [ db.StandaloneTitle, 'StandaloneCustomTitles', 'updatedAt', 'DESC']
        ]
    });

    res.send(posts);
}));


router.route('/finish-alt-title-signup/:token')

.post(wrapAsync(async function(req, res) {

    let verificationToken = await db.Token.findOne({
        where: {
          tokenStr: req.params.token,
          tokenType: constants.TOKEN_TYPES.ACCOUNT_VERIFICATION,
          expires: { [Op.gt]: Date.now() }
        },
        include: [{
          model: db.Source
        }]
      });
    
    let authUser = verificationToken.Source;
    let authUserPreferences = await db.Preferences.findOrCreate({
        where: {
            sourceId: authUser.id
        }
    });

    let oldPreferences;
    if (authUserPreferences[0].preferencesBlob == undefined)
        oldPreferences = {};
    else
        oldPreferences = JSON.parse(authUserPreferences[0].preferencesBlob);

    let updatedPreferences = oldPreferences;
    updatedPreferences.altExperiment = true;
    authUserPreferences[0].preferencesBlob = JSON.stringify(updatedPreferences);

    let authUserPreferencesProms = [];
    authUserPreferencesProms.push(authUserPreferences[0].save());
    if (authUserPreferences[1])
        authUserPreferencesProms.push(authUserPreferences[0].setSource(authUser));

    await Promise.all(authUserPreferencesProms);

    let preferences = await db.Preferences.findAll({
        where: {
            '$Source.id$': {
                [Op.ne]: authUser.id
            }
        },
        include: [{
            model: db.Source
        }]
    });

    let proms = [];

    preferences.forEach(preference => {
        if (preference.preferencesBlob != undefined) {
            let preferencesBlob = JSON.parse(preference.preferencesBlob);
            console.log('blob', preferencesBlob)
            if ('altExperiment' in preferencesBlob) {
                proms.push(...[
                    authUser.addFollow(preference.Source),
                    preference.Source.addFollow(authUser)
                ])
            }
        }
        
    });

    await Promise.all([...proms, verificationToken.destroy()]);
  
    res.send({ message: 'Finished alt title signup' })
}));


router.route('/study-users')

.get(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

    let preferences = await db.Preference.findAll({
        include: [{
            model: db.Source
        }]
    });

    let sources = [];
    preferences.forEach(preference => {
        let preferencesBlob = JSON.parse(preference.preferencesBlob);
        if ('altExperiment' in preferencesBlob) {
            sources.push(preference.Source);
        }
    });

    res.send(sources);
}));



router.route('/headline-study-log')

.post(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

    logger.study(`${req.user.id}, ${req.body.type}, ${req.body.data}`);
    res.send({ message: 'Log successful' });
}));

module.exports = router;
