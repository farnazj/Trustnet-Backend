'use strict';

module.exports = (sequelize, DataTypes) => {
  const CustomTitle = sequelize.define('CustomTitle', {
    text: {
      type: DataTypes.TEXT('long')
    },
    version: {
      type: DataTypes.INTEGER,
      defaultValue: 1
    },
    setId: {
      type: DataTypes.STRING,
    }
  }, {
    charset: 'utf8mb4',
  });


  CustomTitle.associate = function (models) {
    models.CustomTitle.belongsToMany(models.Source, {as: 'Endorsers', through: 'TitleEndorsements'});
    models.CustomTitle.belongsToMany(models.StandaloneTitle, {as: 'parentOriginalTitle', through: 'OriginalCustomTitles'});
  };

  return CustomTitle;
};
