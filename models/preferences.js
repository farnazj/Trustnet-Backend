'use strict';

module.exports = (sequelize, DataTypes) => {
    const Preferences = sequelize.define('Preferences', {
        preferencesBlob: {
            type: DataTypes.TEXT('long'),
        }
    }, {
      charset: 'utf8mb4',
    });
  
    Preferences.associate = function (models) {
        models.Preferences.belongsTo(models.Source);
    };
  
    return Preferences;
  };
  