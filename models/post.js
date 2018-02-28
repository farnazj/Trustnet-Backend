'use strict';

module.exports = (sequelize, DataTypes) => {
  const Post = sequelize.define('Post', {
    title: DataTypes.STRING,
    body: DataTypes.STRING,
    version: DataTypes.INTEGER

  });

  Post.associate = function (models) {
    models.Post.belongsToMany(models.Source, { through: 'SourcePostBoosts' });

  };

  return Post;
};
