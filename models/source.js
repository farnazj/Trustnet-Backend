'use strict';
module.exports = (sequelize, DataTypes) => {
  const Source = sequelize.define('Source', {
    firstname: DataTypes.STRING,
    lastname: DataTypes.STRING,
    username: DataTypes.STRING,
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          isEmail: true
        }
    },
    rssfeed: {
      type: DataTypes.STRING,
      isUrl: true
    }
  });


  Source.associate = function (models) {

    models.Source.belongsToMany(models.Post, { through: 'SourcePostBoosts' });
    models.Source.belongsToMany(models.Source, { as: 'Trustee', through: 'SourceTrustee' });
    models.Source.belongsToMany(models.Source, { as: 'Followee', through: 'SourceFollowee' });
    models.Source.belongsToMany(models.Source, { as: 'Mutee', through: 'SourceMutee' });
    models.Source.belongsToMany(models.Source, { as: 'Blockee', through: 'SourceBlockee' });
};


  return Source;
};
