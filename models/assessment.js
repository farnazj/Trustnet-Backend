'use strict';

module.exports = (sequelize, DataTypes) => {
  const Assessment = sequelize.define('Assessment', {
    postCredibility: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 0, //0 for inaccurate, 1 for accurate, 2 for not sure
        max: 2,
      }
    },
    body: {
      type: DataTypes.STRING,
      // allowNull: false
    },
    version: {
      type: DataTypes.INTEGER,
      defaultValue: 1
    }

  });

  return Assessment;
};
