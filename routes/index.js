var models = require('../models');
var express = require('express');
var routeHelpers = require('../helpers/routeHelpers');

var router = express.Router();


router.get('/', routeHelpers.isLoggedIn, function(req, res, next) {

      models.Source.findById(req.user.id).then( user => {
        return user.getTrusteds();
      }).then(trusteds => {
        trusteds.map(el => {
          console.log(el.rssfeed)
        })

      })


  res.render('index', { title: 'Express' });
});

module.exports = router;
