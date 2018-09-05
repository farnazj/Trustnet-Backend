'use strict';

module.exports = (sequelize, DataTypes) => {
  const Boost = sequelize.define('Boost', {
  });

  Boost.associate = function (models) {
    models.Boost.belongsToMany(models.Source, {as: 'Boosters', through: 'SourcePostBoosts', foreignKey: { allowNull: false }});
    models.Boost.belongsToMany(models.Source, {as: 'Targets', through: 'PostTargetBoosts'});
    models.Boost.belongsToMany(models.Post, {as: 'PostBoosts', through: 'PostBoosts', foreignKey: { allowNull: false }});
  };

  return Boost;
};
