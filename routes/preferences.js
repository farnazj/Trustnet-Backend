var express = require('express');
var router = express.Router();
var Sequelize = require('sequelize');
var db  = require('../models');
var routeHelpers = require('../lib/routeHelpers');
var wrapAsync = require('../lib/wrappers').wrapAsync;

router.route('/preferences/:source_id')

.get(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

    if (req.user.id !== req.params.source_id)
        res.status(403).send({ message: 'User is not authorized to perform this request' });
    else {
        let preferences = await db.Preferences.findOne({
            where: {
                sourceId: req.params.source_id
            }
        });

        res.send(preferences);
    }
}))

.post(wrapAsync(async function(req, res) {
    if (req.user.id !== req.params.source_id)
        res.status(403).send({ message: 'User is not authorized to perform this request' });
    else {
        await db.Preferences.update({
            ...reqBody
        }, {
            where: {
                sourceId: req.params.source_id
            }
        });

        res.send({ message: 'Preferences are updated' });
    }

}));
  

module.exports = router;