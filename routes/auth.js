var express = require('express');
var router = express.Router();
const passport = require('passport');
var routeHelpers = require('../lib/routeHelpers');
var authController = require('../controllers/authcontroller.js');


router.route('/login')
.post(passport.authenticate('local-login'), function(req, res){
  const user = req.user;
  req.session.save(() => {
  //     //res.redirect('/');
  //     res.send({'msg': 'login successful'});
  res.send({'user': user});

      })
});

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
