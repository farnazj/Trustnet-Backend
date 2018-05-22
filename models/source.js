'use strict';


/*
The defaultValue = '' is a workaround to Sequelize's restriction that skips custom validation when
the provided value is undefined or null. For this workaround to work, the passed value needs to be
null.
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
      }
  });


  Source.prototype.toJSON =  function () {
    var values = Object.assign({}, this.get());

    delete values.passwordHash;
    delete values.SourceTrusteds;
    delete values.SourceFollows;
    delete values.SourceMutes;
    delete values.SourceBlocks;

    return values;
  }

  Source.associate = function (models) {

    models.Source.belongsToMany(models.Post, {as: 'PostBoosts', through: 'SourcePostBoosts' });
    models.Source.hasMany(models.Post, {as: 'InitiatedPosts'});
    models.Source.hasMany(models.Assessment, {as: 'SourceAssessments'});
    models.Source.hasMany(models.Feed, {as: 'SourceFeeds'});

    models.Source.belongsToMany(models.Source, { as: 'Trusteds', through: 'SourceTrusteds' });
    models.Source.belongsToMany(models.Source, { as: 'Follows', through: 'SourceFollows' });
    models.Source.belongsToMany(models.Source, { as: 'Mutes', through: 'SourceMutes' });
    models.Source.belongsToMany(models.Source, { as: 'Blocks', through: 'SourceBlocks' });
};


  return Source;
};
