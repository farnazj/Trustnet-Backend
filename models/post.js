'use strict';

module.exports = (sequelize, DataTypes) => {
  const Post = sequelize.define('Post', {
    title: DataTypes.TEXT('long'),
    description: DataTypes.TEXT('long'),
    body: DataTypes.TEXT('long'),
    version: {
      type: DataTypes.INTEGER,
      defaultValue: 1
    },
    url:{
       type: DataTypes.STRING,
       validate:{
          isUrl: true
       }
     },
     image: {
        type: DataTypes.STRING,
        validate:{
           isUrl: true
        }
      }
  });

  Post.associate = function (models) {
    models.Post.belongsToMany(models.Source, {as: 'Boosters', through: 'SourcePostBoosts' });
    models.Post.hasMany(models.Assessment, {as: 'PostAssessments'});
  };

  return Post;
};
