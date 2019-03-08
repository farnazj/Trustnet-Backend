var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
//var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var fs = require('fs');
var passport = require('passport');
var session = require('express-session');
var LocalStrategy = require('passport-local').Strategy;
var models = require('./models');
//var flash = require('connect-flash');
var cors = require('cors');
require('dotenv').config(); //for loading environment variables into process.env

//var LocalStrategy = require('passport-local').Strategy;


var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(cors({credentials: true, origin: true}));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
//app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    secret: process.env.SESSION_KEY,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false, maxAge: 14400000 }
}));

if (app.get('env') === 'production') {
    app.set('trust proxy', 1)
    sess.cookie.secure = true //TODO: serve secure cookies
}

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

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
