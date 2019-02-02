'use strict';

module.exports = (sequelize, DataTypes) => {
  const Assessment = sequelize.define('Assessment', {
    postCredibility: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 0, //0 for inaccurate, 2 for accurate, 1 for not sure
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
