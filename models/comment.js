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
    },
    parentType: {
        type: DataTypes.INTEGER
    },
    parentId: {
        type: DataTypes.INTEGER
    },
    parentSetId: {
        type: DataTypes.UUID
    },
    rootType: {
        type: DataTypes.INTEGER
    },
    rootSetId: {
        type: DataTypes.UUID // Actually either a comment setId (uuid) or an assessment sourceId (integer)
    }
  }, {
    charset: 'utf8mb4',
  });


  Comment.associate = function (models) {
    // models.Comment.belongsTo(models.Comment, { as: 'ParentComment' });
    // models.Comment.belongsTo(models.Assessment, { as: 'ParentAssessment' });

    // models.Comment.belongsTo(models.Comment, { as: 'RootComment' });
    // models.Comment.belongsTo(models.Assessment, { as: 'RootAssessment' });

    models.Comment.belongsTo(models.Post);
    models.Comment.belongsTo(models.Source);
  };

  return Comment;
};
