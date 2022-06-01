var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var morgan = require('morgan');
const logger = require('./lib/logger');
//var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var fs = require('fs');
var passport = require('passport');
var session = require('express-session');
var redisStore = require('connect-redis')(session);
var LocalStrategy = require('passport-local').Strategy;
var models = require('./models');
var cors = require('cors');
var compression = require('compression');
var helmet = require('helmet');
const { v4: uuidv4 } = require('uuid');
var rfs = require('rotating-file-stream');
require('dotenv').config({ path: path.join(__dirname,'.env') }); //for loading environment variables into process.env
var redisClient = require('./lib/redisConfigs');

const { AssertionError } = require('assert');
const { DatabaseError } = require('sequelize');

var app = express();

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(cors({credentials: true, origin: true}));
app.use(helmet());


//a rotating write stream
var accessErrLogStream = rfs.createStream('access_err.log', {
 interval: '1d', // rotate daily
 path: path.join(__dirname, 'log')
})

var accessOkLogStream = rfs.createStream('access_ok.log', {
 interval: '1d', // rotate daily
 path: path.join(__dirname, 'log')
})

morgan.token('user', (req) => {
  if (req.user) { 
    return req.user.id;
  }
  return 'no user info';
});

morgan.token('req-headers', (req) => {
  let customHeaders =  Object.fromEntries(Object.entries(req.headers).filter(([key, value]) => 
    !['cookie', 'if-none-match', 'accept-language', 'sec-ch-ua', 'sec-ch-ua-mobile', 'connection', 'sec-fetch-site', 'sec-fetch-mode',  'sec-fetch-dest', 'accept-encoding'].includes(key)
  ));
  return JSON.stringify(customHeaders);
});

morgan.token('req-body', (req) => {
  if (! ['/login', '/signup', '/reset-password'].includes(req.url)) {
    if (req.url == '/custom-titles-match')
      return 'HASHES REDACTED'
    else
      return JSON.stringify(req.body);
  }
    
  else
    return 'CREDS REDACTED';
});


const originalSend = app.response.send;

app.response.send = function sendOverWrite(body) {
  originalSend.call(this, body);
  this.__custombody__ = body;
}

morgan.token('res-body', (_req, res) =>
  JSON.stringify(res.__custombody__),
)

function morganFormat(tokens, req, res) {
  return [
    tokens.method(req, res),
    tokens.url(req, res),
    'user-' + tokens.user(req, res),
    tokens.status(req, res),
    tokens.res(req, res, 'content-length'), '-',
    tokens['response-time'](req, res), 'ms',
    tokens.date(req, res, 'iso'),
    'req-headers-' + tokens['req-headers'](req),
    'req-body-' + tokens['req-body'](req),
    // 'response-' + tokens['res-body'](req, res)
  ].join(' ')
};

app.use(morgan(morganFormat, {
    skip: function (req, res) {
        return res.statusCode >= 400
    }, stream: accessOkLogStream
}));

app.use(morgan(morganFormat, {
    skip: function (req, res) {
        return res.statusCode < 400
    }, stream: accessErrLogStream
}));


app.use(express.json({limit: '750kb'}));
app.use(express.urlencoded({ extended: true, limit: '750kb'}));
//app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(compression()); //Compress all routes

var sess = {
  genid: function(req) {
   return uuidv4() // use UUIDs for session IDs
  },
  secret: process.env.SESSION_KEY,
  name: process.env.COOKIE_NAME,
  resave: false,
  saveUninitialized: true,
  cookie: {
    httpOnly: false,
    secure: false,
    maxAge: 4 * 24 * 60 * 60 * 1000
  },
  rolling: true,
  store: new redisStore({ host: 'localhost', port: 6379, client: redisClient}),
};

if (app.get('env') === 'production') {
  //app.set('trust proxy', 1)
  //sess.cookie.secure = true //TODO: serve secure cookies
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
//       message: 'Error in connecting to the database'
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
  console.log('universal error handler', err)
  res.send({message: 'Server error'});
});

module.exports = app;
