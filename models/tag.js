'use strict';

module.exports = (sequelize, DataTypes) => {
  const Tag = sequelize.define('Tag', {
    text: DataTypes.TEXT('medium')
  }, {
    charset: 'utf8mb4',
  });

  Tag.prototype.toJSON =  function () {
    var values = Object.assign({}, this.get());

    delete values.PostTags;
    return values;
  }

  Tag.associate = function (models) {
    models.Tag.belongsToMany(models.Post, { through: 'PostTags'});
  };

  return Tag;
};
