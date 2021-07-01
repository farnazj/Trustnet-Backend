'use strict';

module.exports = (sequelize, DataTypes) => {
  const HeadlineOrigin = sequelize.define('HeadlineOrigin', {
    url: {
      type: DataTypes.TEXT('medium'),
      validate:{
          isUrl: true
      }
    }
  }, {
    charset: 'utf8mb4',
  });

  return HeadlineOrigin;
};
