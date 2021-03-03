'use strict';

module.exports = (sequelize, DataTypes) => {
  const StandaloneTitle = sequelize.define('StandaloneTitle', {
    text: {
      type: DataTypes.STRING
    },
    hash: {
      type: DataTypes.STRING
    }
  }, {
    charset: 'utf8mb4',
  });


  StandaloneTitle.associate = function (models) {
    models.StandaloneTitle.hasMany(models.CustomTitle, {as: 'StandaloneCustomTitles'});
    models.StandaloneTitle.belongsTo(models.Post);
  };

  return StandaloneTitle;
};
