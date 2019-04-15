var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var morgan = require('morgan');
const logger = require('./lib/logger');
//var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var fs = require('fs');
var passport = require('passport');
var redis   = require("redis");
var session = require('express-session');
var redisStore = require('connect-redis')(session);
var LocalStrategy = require('passport-local').Strategy;
var models = require('./models');
var cors = require('cors');
var compression = require('compression')
var helmet = require('helmet');
const uuidv4 = require('uuid/v4');
var rfs = require('rotating-file-stream')
require('dotenv').config(); //for loading environment variables into process.env

var client  = redis.createClient();
const { AssertionError } = require('assert');
const { DatabaseError } = require('sequelize');

var app = express();

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(cors({credentials: true, origin: true}));
app.use(helmet());


//a rotating write stream
var accessErrLogStream = rfs('access_err.log', {
 interval: '1d', // rotate daily
 path: path.join(__dirname, 'log')
})

var accessOkLogStream = rfs('access_ok.log', {
 interval: '1d', // rotate daily
 path: path.join(__dirname, 'log')
})

app.use(morgan('dev', {
    skip: function (req, res) {
        return res.statusCode >= 400
    }, stream: accessOkLogStream
}));

app.use(morgan('dev', {
    skip: function (req, res) {
        return res.statusCode < 400
    }, stream: accessErrLogStream
}));


app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
//app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(compression()); //Compress all routes

var sess = {
  genid: function(req) {
   return uuidv4() // use UUIDs for session IDs
  },
  secret: process.env.SESSION_KEY,
  resave: false,
  saveUninitialized: true,
  cookie: {
    httpOnly: false,
    secure: false,
    maxAge: 7 * 24 * 60 * 60 * 1000
  },
  rolling: true,
  store: new redisStore({ host: 'localhost', port: 6379, client: client}),
};

if (app.get('env') === 'production') {
  app.set('trust proxy', 1)
  sess.cookie.secure = true //TODO: serve secure cookies
}

app.use(session(sess));


app.use(passport.initialize())
app.use(passport.session());

//bootstrap routes
var routesPath = path.join(__dirname, 'routes');
fs.readdirSync(routesPath).forEach(function(file){
 app.use('/', require(routesPath + '/' + file));
});

require('./config/passport/passport.js')(passport);


// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

app.use(function handleAssertionError(error, req, res, next) {

  if (error instanceof AssertionError) {
    logger.error(error.message);
    return res.status(400).json({
      type: 'AssertionError',
      message: 'Not Found'
    });
  }
  next(error);
});

// app.use(function handleDatabaseError(error, req, res, next) {
//
//   if (error instanceof DatabaseError) {
//     console.log(error.message);
//     return res.status(503).json({
//       type: 'DatabaseError',
//       message: 'Error in connceting to the database'
//     });
//   }
//   next(error);
// });

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  logger.error(err)
  res.send({message: 'Server error'});
});

module.exports = app;
