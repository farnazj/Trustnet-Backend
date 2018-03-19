'use strict';


/*
The defaultValue = '' is a workaround to Sequelize's bug that skips custom validation when
the provided value is undefined or null. It
*/


/*
allow for firstname and lastname of sources made by the system to be null (ex: CNN)
*/
function allowNullforSystemMade(value, systemMade, field) {

    if (systemMade != 1 && !value) {
      throw new Error( field, ' should be defined!');
      }
    }

module.exports = (sequelize, DataTypes) => {
  const Source = sequelize.define('Source', {
    systemMade: {
      type: DataTypes.BOOLEAN
    },
    firstName: {
      type: DataTypes.STRING,
      defaultValue: '',
      validate: {
        function(value){
          allowNullforSystemMade(value, this.systemMade, "firstName");
        }
      }
    },
    lastName: {
      type: DataTypes.STRING,
      defaultValue: '',
      validate: {
        function(value){
          allowNullforSystemMade(value, this.systemMade, "lastName");
        }
      }
    },
    userName: {
      type: DataTypes.STRING,
      allowNull: false
    },
    passwordHash: {
      type: DataTypes.STRING,
      allowNull: false
    },
    email: {
        type: DataTypes.STRING,
        defaultValue: '',
        validate: {
          isEmail: true,
          function(value){
            allowNullforSystemMade(value, this.systemMade, "email");
          }
        }
    },

    rssfeed: {
      type: DataTypes.STRING,
      isUrl: true
    }
  });



  Source.associate = function (models) {

    models.Source.belongsToMany(models.Post, { through: 'SourcePostBoosts' });
    models.Source.hasMany(models.Post, {as: 'InitiatedPosts'});

    models.Source.belongsToMany(models.Source, { as: 'Trustee', through: 'SourceTrustee' });
    models.Source.belongsToMany(models.Source, { as: 'Followee', through: 'SourceFollowee' });
    models.Source.belongsToMany(models.Source, { as: 'Mutee', through: 'SourceMutee' });
    models.Source.belongsToMany(models.Source, { as: 'Blockee', through: 'SourceBlockee' });
};


  return Source;
};
