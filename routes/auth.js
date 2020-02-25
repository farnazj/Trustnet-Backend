var express = require('express');
var router = express.Router();
const passport = require('passport');
var routeHelpers = require('../lib/routeHelpers');
var wrapAsync = require('../lib/wrappers').wrapAsync;
var db  = require('../models');
var constants = require('../lib/constants');
const logger = require('../lib/logger');
var transporter = require('../lib/transporter');
var Sequelize = require('sequelize');
const Op = Sequelize.Op;
var crypto = require('crypto');
require('dotenv').config();


router.route('/login')

.post(function(req, res, next) {

  passport.authenticate('local-login', function(err, user, info) {
    if (err) {
      return next(err)
    }
    if (!user) {
      return res.status(400).send({ message: info.message });
    }
    else {
      req.logIn(user, function(err) {
        if (err) {
          return next(err);
        }
        return res.send({'user': user});
      });
    }
  })(req, res, next)
});


router.route('/logout')

.post( function(req, res) {

  req.logout();
  res.sendStatus(200);
});


router.route('/signup')

.post(function(req, res, next) {

  passport.authenticate('local-signup', function(err, user, info) {

    if (err) {
      return next(err);
    }

    if (user) {

      crypto.randomBytes(20, async function(err, buf) {
         let tokenStr = buf.toString('hex');
         let token = await db.Token.create({
           tokenStr,
           tokenType: constants.TOKEN_TYPES.VERIFICATION,
           expires: Date.now() + constants.TOKEN_EXP.VERIFICATION
         });
         token.setSource(user);
         let verificationLink = constants.CLIENT_BASE_URL + '/verify-account/' + tokenStr;

         const passResetMailOptions = {
           from: process.env.EMAIL_USER,
           to: user.email,
           subject: 'Account Verification for Trustnet',
           html: `<p>Hi ${user.firstName}!</p>
           <p>Thanks for signing up for Trustent. If this wasn't you, please ignore
           this email and we will remove your address from our records.</p>
           <p>To activate your account, please click on the following link within the next 6 hours:</p>
           <p> <a href="${verificationLink}">${verificationLink}</a></p>
           <br>
           <p>-The Trustnet team</p>`
         };

         transporter.sendMail(passResetMailOptions, function (err, info) {
            if(err)
              logger.error(err);
            else
              logger.info(info);
         });
      })

      res.status(202).send({ message: `Thanks for signing up! You should soon receive
        an email containing information on how to activate your account.` })
    }
    else {
      res.status(400).send({ message: info.message });
    }

 })(req, res, next);
});


router.route('/verify-account/:token')

.post(wrapAsync(async function(req, res) {

  let verificationToken = await db.Token.findOne({
    where: {
      tokenStr: req.params.token,
      tokenType: constants.TOKEN_TYPES.VERIFICATION,
      expires: { [Op.gt]: Date.now() }
    },
    include: [{
      model: db.Source
    }]
  });

  if (!verificationToken) {
    res.status(403).send({ message: 'Verification token is invalid or has expired.' });
  }
  else {
    if (!verificationToken.Source.isVerified) {
      verificationToken.Source.update({isVerified: true});
      verificationToken.destroy();
      res.send({ message: 'User is now verified' });
    }
    else
      console.log('What the hell');
  }

}));


router.route('/forgot-password')

.post(wrapAsync(async function(req, res) {

  let source = await db.Source.findOne({ where: { email: req.body.email } });
   if (source) {
     crypto.randomBytes(20, async function(err, buf) {
        let tokenStr = buf.toString('hex');
        let token = await db.Token.create({
          tokenStr,
          tokenType: constants.TOKEN_TYPES.RECOVERY,
          expires: Date.now() + constants.TOKEN_EXP.RECOVERY
        });
        token.setSource(source);

        let signupLink = constants.CLIENT_BASE_URL + '/reset-password/' + tokenStr;

        const passResetMailOptions = {
          from: process.env.EMAIL_USER,
          to: source.email,
          subject: 'Password Reset for Trustnet',
          html: `<p>Hi ${source.firstName}!</p>
          <p>Forgot your password? Click on the link below or copy and paste it into
           your browser within the next 4 hours.</p>
          <p>If you don't want to reset your password, just ignore this email.</p>
          <p><a href="${signupLink}">${signupLink}</a></p>
          <p>Your username, in case you have forgotten it is: ${source.userName}</p>
          <br>
          <p>-The Trustnet team</p>`
        };

        transporter.sendMail(passResetMailOptions, function (err, info) {
           if(err)
             logger.error(err);
           else
             logger.info(info);
        });
      });
   }

   res.status(202).send({message: `If an account with that email address exists,
     you should soon receive an email with instructions on how to reset your password.`})
}));


router.route('/reset-password/:token')

.post(wrapAsync(async function(req, res) {

  let token = await db.Token.findOne({
    where: {
      tokenStr: req.params.token,
      tokenType: constants.TOKEN_TYPES.RECOVERY,
      expires: { [Op.gt]: Date.now() }
    },
    include: [{
      model: db.Source
    }]
  });

  if (!token) {
    res.status(403).send({message: 'Password reset token is invalid or has expired.' })
  }
  else {
    let passwordHash = await routeHelpers.generateHash(req.body.password);
    await Promise.all([ token.Source.update({
      passwordHash,
    }), token.destroy()]);

    res.send({ message: 'Password updated' });
  }

}))

module.exports = router;
