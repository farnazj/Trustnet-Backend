var express = require('express');
var router = express.Router();
var models  = require('../models');
const passport = require('passport');


var authController = require('../controllers/authcontroller.js');

router.route('/signup')

.get( authController.signup)

.post( passport.authenticate('local-signup', {
        successRedirect: '/',
        failureRedirect: '/signup',
        failureFlash: true
    }
))


module.exports = router;
