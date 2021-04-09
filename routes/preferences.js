var express = require('express');
var router = express.Router();
var Sequelize = require('sequelize');
var db  = require('../models');
var routeHelpers = require('../lib/routeHelpers');
var wrapAsync = require('../lib/wrappers').wrapAsync;

router.route('/preferences/:source_id')

.get(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

    if (req.user.id != req.params.source_id)
        res.status(403).send({ message: 'User is not authorized to perform this request' });
    else {
        let preferences = await db.Preferences.findOne({
            where: {
                sourceId: req.params.source_id
            }
        });

        let result = preferences ? preferences.preferencesBlob : '{}';
        res.send(result);
    }
}))

.post(wrapAsync(async function(req, res) {

    if (req.user.id != req.params.source_id)
        res.status(403).send({ message: 'User is not authorized to perform this request' });
    else {

        let results = await db.Preferences.findOrCreate({
            where: {
                sourceId: req.params.source_id
            }
        });

        if (results[1]) {
            let authUser = await db.Source.findByPk(req.user.id);
            results[0].setSource(authUser);
        }

        await results[0].update({
            preferencesBlob: req.body.preferences
        });

        res.send({ message: 'Preferences are updated' });
    }

}));
  

module.exports = router;