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
    url: {
       type: DataTypes.TEXT('medium'),
       validate:{
          isUrl: true
       }
     },
     image: {
        type: DataTypes.TEXT('long'),
        // validate:{
        //    isUrl: true
        // }
      },
      author: DataTypes.STRING,
      publishedDate: DataTypes.DATE,
      opinion: DataTypes.BOOLEAN
  }, {
    charset: 'utf8mb4',
  });

  Post.prototype.toJSON = function () {
    var values = Object.assign({}, this.get());

    delete values.PostSeers;
    return values;
  }

  Post.associate = function (models) {
    models.Post.hasMany(models.Boost, {as: 'PostBoosts'});
    models.Post.belongsToMany(models.Source, {as: 'Seers', through: 'PostSeers'});
    models.Post.hasMany(models.Assessment, {as: 'PostAssessments'});
    // models.Post.hasMany(models.CustomTitle, {as: 'PostCustomTitles'});
    models.Post.belongsToMany(models.Tag, {through: 'PostTags'});
    models.Post.hasMany(models.StandaloneTitle, {as: 'PostStandAloneTitles' });
  };

  return Post;
};
