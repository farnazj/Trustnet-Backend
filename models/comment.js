'use strict';

module.exports = (sequelize, DataTypes) => {
  const Comment = sequelize.define('Comment', {
    body: {
      type: DataTypes.TEXT('long')
    },
    version: {
      type: DataTypes.INTEGER,
      defaultValue: 1
    },
    setId: {
        type: DataTypes.UUID
    }
  }, {
    charset: 'utf8mb4',
  });


  Comment.associate = function (models) {
    models.Comment.belongsTo(models.Comment, { as: 'ParentComment' });
    models.Comment.belongsTo(models.Assessment, { as: 'ParentAssessment' });
    models.Comment.belongsTo(models.Post);
    models.Comment.belongsTo(models.Source);
  };

  return Comment;
};
