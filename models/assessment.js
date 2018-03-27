'use strict';

module.exports = (sequelize, DataTypes) => {
  const Assessment = sequelize.define('Assessment', {
    body: {
      type: DataTypes.STRING,
      allowNull: false
    },
    version: {
      type: DataTypes.INTEGER,
      defaultValue: 1
    }

  });

  return Assessment;
};
