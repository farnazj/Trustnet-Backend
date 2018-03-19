var bCrypt = require('bcrypt');
var LocalStrategy = require('passport-local').Strategy;
var models = require('../../models');



module.exports = function(passport) {

    var User = models.Source;
    passport.use('local-signup', new LocalStrategy({
      passReqToCallback: true
      },

        function(req, username, password, done) {

            var generateHash = function(password) {
                return bCrypt.hashSync(password, bCrypt.genSaltSync(8), null);
            };

            User.findOne({
                where: {
                    userName: username
                }
            }).then(function(user) {

                if (user)
                {
                    return done(null, false, {
                        message: 'That username is already taken'
                    });

                } else
                {
                  User.findOne({
                     where: {
                       email: req.body.email
                     }
                   }).then(function(user){

                      if (user) {
                        return done(null, false, {
                          message: 'That email is already taken'
                         });
                      }
                      else {
                        var userPassword = generateHash(password);
                        var data =
                            {
                              firstName: req.body.firstname,
                              lastName: req.body.lastname,
                              userName: username,
                              passwordHash: userPassword,
                              email: req.body.email,
                              systemMade: false
                            };

                        Object.entries(data).forEach(([key, value]) => data[key] = value == null ? undefined : value);

                          User.create(data).then(function(newUser, created) {

                              if (!newUser) {
                                  return done(null, false);
                              }

                              if (newUser) {
                                  return done(null, newUser);
                              }

                          }).catch(function(reason){
                              return done(null, false, { message: reason });
                          });
                      }

                   });



                }

            });

        }

    ));

    passport.serializeUser(function(user, done) {

      done(null, user.id);

    });

    passport.deserializeUser(function(id, done) {

      User.findById(id).then(function(user) {

          if (user) {

              done(null, user.get());

          } else {

              done(user.errors, null);

          }

      });

  });
}
