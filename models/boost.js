'use strict';

module.exports = (sequelize, DataTypes) => {
  const Boost = sequelize.define('Boost', {
  });

  Boost.associate = function (models) {
    models.Boost.belongsToMany(models.Source, {as: 'Boosters', through: 'SourceBoosts', foreignKey: { name:'BoostId', allowNull: false }});
    models.Boost.belongsToMany(models.Source, {as: 'Targets', through: 'TargetBoosts'});
    //models.Boost.belongsToMany(models.Post, {as: 'Posts', through: 'PostBoosts', foreignKey: {name: 'BoostId', allowNull: false }});
  };

  return Boost;
};
