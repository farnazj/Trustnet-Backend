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

router.route('/headline-origins')
.post(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

    await db.HeadlineOrigin.findOrCreate({
        where: {
            url: req.body.url
        }
    });
    res.send({ message: 'URL added to whitelisted origins' });
}))

/*
checks whether a URL is in the database of HeadlineOrigins
*/
.get(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

    let requestedHeadline = req.headers.url;
    let foundOrigin = await db.HeadlineOrigin.findOne({
        where: {
            url: requestedHeadline
        }
    })

    let result = (foundOrigin != null) ? true : false;
    res.send(result);
}));

module.exports = router;
