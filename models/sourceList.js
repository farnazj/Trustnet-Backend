'use strict';

module.exports = (sequelize, DataTypes) => {
  const SourceList = sequelize.define('SourceList', {
    name: {
      type: DataTypes.TEXT('long')
    }
  }, {
    charset: 'utf8mb4',
  });

  return SourceList;
};
