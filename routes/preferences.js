var express = require('express');
var router = express.Router();
var Sequelize = require('sequelize');
var db  = require('../models');
var routeHelpers = require('../lib/routeHelpers');
var constants = require('../lib/constants');
var wrapAsync = require('../lib/wrappers').wrapAsync;

router.route('/preferences')

.get(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

    let preferences = await db.Preferences.findOne({
        where: {
            sourceId: req.user.id
        }
    });

    let result = preferences ? preferences.preferencesBlob : '{}';
    res.send(result);
}))

.post(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

    let results = await db.Preferences.findOrCreate({
        where: {
            sourceId: req.user.id
        }
    });

    if (results[1]) {
        results[0].preferencesBlob = JSON.stringify({ 
            "reheadlineBlackListedWebsites": constants.DEFAULT_HEADLINE_BLACKLISTS,
            "trustnetBlackListedWebsites": []
         });
        let authUser = await db.Source.findByPk(req.user.id);
        results[0].setSource(authUser);
    }

    results[0].preferencesBlob = req.body.preferences;
    await results[0].save();

    res.send({ message: 'Preferences are updated' });
}));
  

module.exports = router;