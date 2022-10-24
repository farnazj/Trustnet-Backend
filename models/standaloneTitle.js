'use strict';

module.exports = (sequelize, DataTypes) => {
  const StandaloneTitle = sequelize.define('StandaloneTitle', {
    text: {
      type: DataTypes.TEXT('medium')
    },
    hash: {
      type: DataTypes.STRING
    }
  }, {
    charset: 'utf8mb4',
  });


  StandaloneTitle.associate = function (models) {
    models.StandaloneTitle.belongsToMany(models.CustomTitle, {as: 'StandaloneCustomTitles', through: 'OriginalCustomTitles'});
    models.StandaloneTitle.belongsTo(models.Post);
  };

  return StandaloneTitle;
};