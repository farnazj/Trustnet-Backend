var express = require('express');
var router = express.Router();
const passport = require('passport');
var routeHelpers = require('../lib/routeHelpers');

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
})

// .post(passport.authenticate('local-login'), function(req, res){
//   const user = req.user;
//   req.session.save(() => {
//   //     //res.redirect('/');
//   //     res.send({'msg': 'login successful'});
//     res.send({'user': user});
//       })
// });

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
})

module.exports = router;
