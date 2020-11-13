'use strict';

/*
For boosts by the initiator source of an article, the createdAt timestamp
is updated to mark the time that the story was published by the source. This means
that for posts imported from other websites or those fetched from feeds, the createdAt
field (for the boost by the original soruce) is updated and the updatedAt field marks 
the creation of the boost entry (a boost is not updated after creation). For posts 
created through the system, the two fields createdAt and updatedAt mark the same time.
*/
module.exports = (sequelize, DataTypes) => {
  const Boost = sequelize.define('Boost', {
  });

  Boost.associate = function (models) {
    models.Boost.belongsTo(models.Source, {as: 'Booster', foreignKey: { name:'SourceId'}});
    models.Boost.belongsToMany(models.Source, {as: 'Targets', through: 'TargetBoosts'});
  };

  return Boost;
};
