'use strict';

module.exports = (sequelize, DataTypes) => {
  const Boost = sequelize.define('Boost', {
  });

  Boost.associate = function (models) {
    //models.Boost.belongsToMany(models.Source, {as: 'Boosters', through: 'SourceBoosts', foreignKey: { name:'BoostId', allowNull: false }});
    models.Boost.belongsTo(models.Source, {as: 'Booster', foreignKey: { name:'SourceId'}});
    models.Boost.belongsToMany(models.Source, {as: 'Targets', through: 'TargetBoosts'});
  };

  return Boost;
};
