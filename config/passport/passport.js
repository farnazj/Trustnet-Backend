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
                return bCrypt.hash(password, bCrypt.genSaltSync(8), null); // a promise
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

                }
                else {
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
                        generateHash(password).then((userPassword) => {

                        var data = {
                          firstName: req.body.firstName,
                          lastName: req.body.lastName,
                          userName: username,
                          passwordHash: userPassword,
                          email: req.body.email,
                          systemMade: false
                        };


                        Object.entries(data).forEach(([key, value]) => data[key] = value == null ? undefined : value);

                          User.create(data).then(function(newUser, created) {

                            if (!newUser) {
                              return done(null, false, {'message': 'Sth went wrong'});
                            }

                            else {
                              console.log('heres the newUser', newUser)
                              return done(null, newUser, {'message': 'New user created'});
                            }

                          })

                        })
                      }

                   })
                }

            }).catch(function(reason){
                return done(null, false, {message: reason});
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
          }
          else {
              done(user.errors, null);
          }

      });

  });


  passport.use('local-login', new LocalStrategy({
        passReqToCallback : true
    },
    function(req, username, password, done) {

        User.findOne({where: {userName: username}}).then(function(user){

          // if no user is found, return the message
          if (!user)
              return done(null, false, { message: 'No user found' });

          bCrypt.compare(password, user.passwordHash, (err, isValid) => {

             if (err) {
               return done(err)
             }
             if (!isValid) {
               return done(null, false);
             }
             return done(null, user);
           })

        }).catch(function(err){
          return done(err);
        });

    }));

  };
