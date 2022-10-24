'use strict';

module.exports = (sequelize, DataTypes) => {
  const Consent = sequelize.define('Consent', {
    value: {
        type: DataTypes.BOOLEAN,
    },
    version: {
        type: DataTypes.INTEGER,
        defaultValue: 1
    }
  }, {
    charset: 'utf8mb4',
  });


  Consent.associate = function (models) {
    models.Consent.belongsTo(models.Source);
  };

  return Consent;
};
