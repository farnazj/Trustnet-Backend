const winston = require("winston");
require('winston-daily-rotate-file');

const level = process.env.LOG_LEVEL || 'debug';

const logFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp(),
  winston.format.align(),
  winston.format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
  );

var errorTransport = new (winston.transports.DailyRotateFile)({
  filename: 'winston/error-%DATE%.log',
  datePattern: 'YYYY-MM-DD-HH',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d',
  level: 'error',
  prepend: true
});

var combinedTransport = new (winston.transports.DailyRotateFile)({
  filename: 'winston/combined-%DATE%.log',
  datePattern: 'YYYY-MM-DD-HH',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d',
  level: level,
  prepend: true
});

var studyTransport = new (winston.transports.DailyRotateFile)({
  filename: 'winston/study-%DATE%.log',
  datePattern: 'YYYY-MM-DD-HH',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d',
  level: 'study',
  prepend: true
});

const customLevels = {
  levels: {
    study: 0,
    error: 1,
    warn: 2, 
    info: 3, 
    http: 4,
    verbose: 5, 
    debug: 6, 
    silly: 7
  },
  colors: {
    study: 'cyan',
    error: 'red',
    warn: 'yellow', 
    info: 'blue', 
    http: 'green',
    verbose: 'gray', 
    debug: 'magenta', 
    silly: 'black'
  }
};
 

const logger = winston.createLogger({
  levels: customLevels.levels,
  format: logFormat,
  transports: [
    errorTransport,
    combinedTransport,
    studyTransport
  ]
});

winston.addColors(customLevels.colors);

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

module.exports = logger;
