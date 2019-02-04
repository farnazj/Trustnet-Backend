'use strict';

module.exports = (sequelize, DataTypes) => {
  const Assessment = sequelize.define('Assessment', {
    postCredibility: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { //specified in constants.VALIDITY_CODES
        min: 0,
        max: 2,
      }
    },
    body: {
      type: DataTypes.TEXT('long')
      // allowNull: false
    },
    version: {
      type: DataTypes.INTEGER,
      defaultValue: 1
    }

  }, {
    charset: 'utf8mb4',
  });

  return Assessment;
};
