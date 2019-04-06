const winston = require("winston");

const level = process.env.LOG_LEVEL || 'debug';

const logger = winston.createLogger({
    transports: [
        new winston.transports.File({
          filename: 'combined.log',
          level: level,
          timestamp: function () {
              return (new Date()).toISOString();
          }
        }),
        new winston.transports.File({
          filename: 'error.log',
          level: 'error',
          timestamp: function () {
              return (new Date()).toISOString();
          }
      })

    ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

module.exports = logger;
