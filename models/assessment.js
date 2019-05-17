'use strict';

module.exports = (sequelize, DataTypes) => {
  const Assessment = sequelize.define('Assessment', {
    postCredibility: {
      type: DataTypes.DOUBLE,
      allowNull: false,
      validate: { //specified in constants.VALIDITY_CODES
        min: -1,
        max: 1,
      }
    },
    body: {
      type: DataTypes.TEXT('long')
    },
    version: {
      type: DataTypes.INTEGER,
      defaultValue: 1
    },
    isTransitive: {
      type: DataTypes.BOOLEAN
    }

  }, {
    charset: 'utf8mb4',
  });

  return Assessment;
};
