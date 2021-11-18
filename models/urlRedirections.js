'use strict';

module.exports = (sequelize, DataTypes) => {
  const URLRedirection = sequelize.define('URLRedirection', {
    originURL: { 
        type: DataTypes.STRING,
        isUrl: true
    },
    targetURL: {
        type: DataTypes.STRING,
        isUrl: true
    },
    lastAccessTime: {
        type: DataTypes.DATE
   }
  }, {
    charset: 'utf8mb4',
  });

  return URLRedirection;
};
