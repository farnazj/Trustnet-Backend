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

const logger = winston.createLogger({
  format: logFormat,
  transports: [
    errorTransport,
    combinedTransport
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

module.exports = logger;
