var express = require('express');
var router = express.Router();
const passport = require('passport');
var routeHelpers = require('../lib/routeHelpers');
var wrapAsync = require('../lib/wrappers').wrapAsync;
var db  = require('../models');
var constants = require('../lib/constants');
var crypto = require('crypto');

router.route('/login')
.post(function(req, res, next){
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
.post( function(req, res){
  req.logout();
  res.sendStatus(200);
});

router.route('/signup')
.post(function(req, res, next){
  passport.authenticate('local-signup', function(err, user, info) {

    if (err) {
      return next(err);
    }

    if (user) {
      res.status(200).send({message: info.message });
    }
    else {
      res.status(400).send({message: info.message });
    }

 })(req, res, next);
});


router.route('/verification/:token')
.post(wrapAsync(async function(req, res){
  let v_token = await db.VerificationToken({
    where: {
      token: req.params.token
    },
    include: [{
      model: db.Source
    }]
  });

  if (!v_token) {
    res.status(403).send({message: 'Token not found'});
  }
  else if ( (v_token.token.createdAt - Date.now())/(3600*1000) > constants.VERIFICATION_TOKEN_EXP ) {
    v_token.destory();
    res.status(403).send({message: 'Token expired'});
  }
  else {
    if (!v_token.Source.isVerified) {
      v_token.Source.update({isVerified: true});
      v_token.destroy();
      res.send({message: 'User is now verified'});
    }
    else
      console.log('What the hell');
  }

}));

router.route('/password-reset')
.post(wrapAsync(async function(req, res){
  let source = await db.Source.findOne({ where: {email: req.body.email} });
   if (!source) {
     res.status(403).send({message: 'No account with that email address exists.'});
   }
   else {
     crypto.randomBytes(20, async function(err, buf) {
        let token_str = buf.toString('hex');
        let token = await db.RecoveryToken.create({
          resetPasswordToken: token,
          resetPasswordExpires: Date.now() + constants.PASSWORD_TOKEN_EXP
        });
        source.setRecoveryToken(token);

        //send email with token
        //link would be trustnet.csail.mit.edu/password-reset/token
        //would be a vue page displaying a form where hey can submit new password
        //which sends a post request to the url below along the token param
        //res.send(202)?
      });
   }
}));

router.route('/password-reset/:token')
.post(wrapAsync(async function(req, res){
  let token = await db.RecoveryToken.findOne({
    where: {
      token: req.params.token,
      expires: { [Op.gt]: Date.now() }
    },
    include: [{
      model: db.Source
    }]
  });
  console.log(token);
  if (!token.source) {
    res.sendStatus(403).send({message: 'Password reset token is invalid or has expired.' })
  }
  else {
    let password_hash = await routeHelpers.generateHash(req.body.password)
    await Promise.all([ source.update({
      passwordHash: password_hash,
    }), token.destroy()]);
    res.sendStatus(204).send({message: 'Password updated'});
  }

}))

module.exports = router;
