var express = require('express');
var router = express.Router();
var models  = require('../models');
const passport = require('passport');
var routeHelpers = require('../helpers/routeHelpers');


var authController = require('../controllers/authcontroller.js');


router.route('/login')
.post(passport.authenticate('local-login', {
    successRedirect : '/',
    failureRedirect : '/login',
    failureFlash : true
}));

router.route('/logout')
.post(routeHelpers.isLoggedIn, function(req, res){
  req.logout();
  res.redirect('/login');
});

router.route('/signup')
.get( authController.signup)
.post( passport.authenticate('local-signup', {
        successRedirect: '/',
        failureRedirect: '/signup',
        failureFlash: true
    }
))


module.exports = router;
