var express = require('express');
var router = express.Router();
var Sequelize = require('sequelize');
var db  = require('../models');
var routeHelpers = require('../lib/routeHelpers');
var wrapAsync = require('../lib/wrappers').wrapAsync;
const Op = Sequelize.Op;
// var kue = require('kue')
//  , queue = kue.createQueue();

router.route('/consent')
//get the most recent consent instance
.get(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

    let consent = await db.Consent.findOne({
        where: {
            [Op.and]: [{
                SourceId: req.user.id
            }, {
                version: 1
            }]
        }
    });

    res.send(consent);
}))

.post(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

    let existingConsents = await db.Consent.findAll({
        where: {
            SourceId: req.user.id
        }
    })

    let authUserProm = db.Source.findByPk(req.user.id);

    for (let existingConsent of existingConsents)
        existingConsent.update({ version: existingConsent.version - 1 });

    let newConsentProm = db.Consent.create({ value: req.body.consent });
    let [newConsent, authUser] = await Promise.all([newConsentProm, authUserProm]);
    newConsent.setSource(authUser);

    res.send({ message: 'consent updated' });
}));

module.exports = router;