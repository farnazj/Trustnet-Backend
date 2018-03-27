var models = require('../models');
var express = require('express');
var routeHelpers = require('../helpers/routeHelpers');

var router = express.Router();


router.get('/', routeHelpers.isLoggedIn, function(req, res, next) {
  // console.log(req.user);
  // models.Source.findOne(req.user).then( user => {
  //   user.getTrusteds();
  // })

  res.render('index', { title: 'Express' });
});

module.exports = router;
