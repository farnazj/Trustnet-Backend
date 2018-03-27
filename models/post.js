'use strict';

module.exports = (sequelize, DataTypes) => {
  const Post = sequelize.define('Post', {
    title: DataTypes.STRING,
    body: DataTypes.STRING,
    version: DataTypes.INTEGER,
    url:{
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
