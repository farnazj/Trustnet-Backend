var models = require('../models');
var express = require('express');
var routeHelpers = require('../helpers/routeHelpers');

var router = express.Router();


router.get('/', routeHelpers.isLoggedIn, function(req, res, next) {

  res.render('index', { title: 'Express' });
});

module.exports = router;
