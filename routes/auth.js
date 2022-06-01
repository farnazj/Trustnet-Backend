var express = require('express');
var router = express.Router();
const passport = require('passport');
var routeHelpers = require('../lib/routeHelpers');
var wrapAsync = require('../lib/wrappers').wrapAsync;
var db  = require('../models');
var constants = require('../lib/constants');
const logger = require('../lib/logger');
var transporterProm = require('../lib/transporter');
var Sequelize = require('sequelize');
const Op = Sequelize.Op;
var crypto = require('crypto');
var path = require('path');
require('dotenv').config({ path: path.join(__dirname,'.env') })


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

      db.Consent.create({ value: req.body.consent })
      .then((consent) => {
        consent.setSource(user);
      })      

      crypto.randomBytes(20, async function(err, buf) {
        let tokenStr = buf.toString('hex');
        let token = await db.Token.create({
          tokenStr,
          tokenType: constants.TOKEN_TYPES.ACCOUNT_VERIFICATION,
          expires: Date.now() + constants.TOKEN_EXP.ACCOUNT_VERIFICATION
        });
        token.setSource(user);

        let clientUrl = req.body.headlineExp ? constants.HEADLINE_CLIENT_BASE_URL : constants.CLIENT_BASE_URL;
        let siteName = req.body.headlineExp ? 'Reheadline' : constants.SITE_NAME;

        let extra = req.body.specialGroup ? `${req.body.specialGroup}/` : 'reg/';

        let verificationLink;
        if (info.type == 'NEW_USER')
          verificationLink = `${clientUrl}/verify-new-account/${extra}${tokenStr}`;
        else
          verificationLink = `${clientUrl}/verify-existing-account/${extra}${tokenStr}`;


        const signupMailOptions = {
          from: process.env.EMAIL_USER,
          to: user.email,
          subject: `Account Verification for ${siteName}`,
          html: `<p>Hi ${user.firstName}!</p>
          <p>Thanks for signing up for ${siteName}. If this wasn't you, please ignore
          this email and we will remove your address from our records.</p>
          <p>To activate your account, please click on the following link within the next 6 hours:</p>
          <p> <a href="${verificationLink}">${verificationLink}</a></p>
          <br>
          <p>-The ${siteName} team</p>`
        };

        let transporter = await transporterProm;

        transporter.sendMail(signupMailOptions, function (err, info) {
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


router.route('/verify-new-account/:token')

.post(wrapAsync(async function(req, res) {

  let verificationToken = await db.Token.findOne({
    where: {
      tokenStr: req.params.token,
      tokenType: constants.TOKEN_TYPES.ACCOUNT_VERIFICATION,
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
      verificationToken.Source.update({ isVerified: true });
      // verificationToken.destroy(); //TODO: restore later
      res.send({ message: 'User is now verified' });
    }
    else
      console.log('What the hell');
  }

}));


router.route('/verify-existing-account/:token')

.post(wrapAsync(async function(req, res) {

  let verificationToken = await db.Token.findOne({
    where: {
      tokenStr: req.params.token,
      tokenType: constants.TOKEN_TYPES.ACCOUNT_VERIFICATION,
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

      let existingUser = await db.Source.findOne({
        where: {
          email: verificationToken.Source.email,
          systemMade: true
        }
      });

      if (!existingUser)
        res.status(403).send({ message: 'Something went wrong' });
      else {
        let tokenAssociatedSource = verificationToken.Source;
        let userData = {
          firstName: tokenAssociatedSource.firstName,
          lastName: tokenAssociatedSource.lastName,
          userName: tokenAssociatedSource.userName,
          passwordHash: tokenAssociatedSource.passwordHash,
          systemMade: false,
          isVerified: true
        }
        await tokenAssociatedSource.destroy();

        await Promise.all([existingUser.update(userData), verificationToken.destroy()]);
        res.send({ message: 'User is now verified' });
      }
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
          tokenType: constants.TOKEN_TYPES.ACOUNT_RECOVERY,
          expires: Date.now() + constants.TOKEN_EXP.ACOUNT_RECOVERY
        });
        token.setSource(source);

        let signupLink = constants.CLIENT_BASE_URL + '/reset-password/' + tokenStr;

        const passResetMailOptions = {
          from: process.env.EMAIL_USER,
          to: source.email,
          subject: `Password Reset for ${constants.SITE_NAME}`,
          html: `<p>Hi ${source.firstName}!</p>
          <p>Forgot your password? Click on the link below or copy and paste it into
           your browser within the next 4 hours.</p>
          <p>If you don't want to reset your password, just ignore this email.</p>
          <p><a href="${signupLink}">${signupLink}</a></p>
          <p>Your username, in case you have forgotten it is: ${source.userName}</p>
          <br>
          <p>-The ${constants.SITE_NAME} team</p>`
        };

        let transporter = await transporterProm;

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
      tokenType: constants.TOKEN_TYPES.ACOUNT_RECOVERY,
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

}));

module.exports = router;
