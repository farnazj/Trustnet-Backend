'use strict';

module.exports = (sequelize, DataTypes) => {
  const SourceList = sequelize.define('SourceList', {
    name: {
      type: DataTypes.TEXT('long')
    }
  }, {
    charset: 'utf8mb4',
  });

  SourceList.associate = function (models) {
    models.SourceList.belongsTo(models.Source, { as: 'ListOwner', foreignKey: { name:'SourceId'} });
    models.SourceList.belongsToMany(models.Source, { as: 'ListEntities', through: 'ListSourceEntities' });
  };

  return SourceList;
};
