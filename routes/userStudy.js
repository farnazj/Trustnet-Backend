var express = require('express');
var router = express.Router();
var Sequelize = require('sequelize');
var db  = require('../models');
var routeHelpers = require('../lib/routeHelpers');
var wrapAsync = require('../lib/wrappers').wrapAsync;
var constants = require('../lib/constants');
var logger = require('../lib/logger');
const source = require('../models/source');
const Op = Sequelize.Op;

router.route('/finish-user-study-signup/:token')

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

    if (authUserPreferences[0].preferencesBlob == undefined) {
        oldPreferences = { 
            "reheadlineBlackListedWebsites": constants.DEFAULT_HEADLINE_BLACKLISTS,
            "trustnetBlackListedWebsites": []
        };
    }
        
    else
        oldPreferences = JSON.parse(authUserPreferences[0].preferencesBlob);

    let updatedPreferences = oldPreferences;
    updatedPreferences.extensionStudy = true;
    authUserPreferences[0].preferencesBlob = JSON.stringify(updatedPreferences);

    let authUserPreferencesProms = [];
    authUserPreferencesProms.push(authUserPreferences[0].save());
    if (authUserPreferences[1])
        authUserPreferencesProms.push(authUserPreferences[0].setSource(authUser));

    await Promise.all(authUserPreferencesProms);

    let otherUsers = await db.Source.findAll({
        where: {
            [Op.and]: [{
                systemMade: false
            }, {
                '$Source.id$': {
                    [Op.ne]: authUser.id
                }
            }]
        },
        include: [{
            model: db.Preferences,
            required: true
        }]
    })

    let proms = [];

    otherUsers.forEach(user => {
        if (user.Preference && user.Preference.preferencesBlob != undefined) {
            let preferencesBlob = JSON.parse(user.Preference.preferencesBlob);
            if ('extensionStudy' in preferencesBlob) {
                proms.push(...[
                    user.addFollow(authUser),
                    authUser.addFollow(user)
                ]);
            }
        }
        // proms.push(authUser.addFollow(user));
    })

    await Promise.all([...proms, verificationToken.destroy()]);
  
    res.send({ message: 'Finished extension study signup' })
}));


router.route('/log-interaction')

.post(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

    logger.study(`${req.user.id}, ${req.body.type}, ${JSON.stringify(req.body.data)}, ${req.body.client}`);
    res.send({ message: 'Log successful' });
}));

module.exports = router;
