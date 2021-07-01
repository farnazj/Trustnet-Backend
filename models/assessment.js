'use strict';

module.exports = (sequelize, DataTypes) => {
  const Assessment = sequelize.define('Assessment', {
    postCredibility: {
      type: DataTypes.DOUBLE,
      allowNull: false,
      validate: { //specified in constants.ACCURACY_CODES
        min: -1,
        max: 1,
      }
    },
    body: {
      type: DataTypes.TEXT('long')
    },
    version: {
      type: DataTypes.INTEGER,
      defaultValue: 1
    },
    isTransitive: {
      type: DataTypes.BOOLEAN
    },
    sourceIsAnonymous: {
      type: DataTypes.BOOLEAN,
      default: true
    }

  }, {
    charset: 'utf8mb4',
  });


  Assessment.prototype.toJSON =  function () {
    var values = Object.assign({}, this.get());

    delete values.AssessmentTargets;
    return values;
  }

  Assessment.associate = function (models) {
    models.Assessment.belongsToMany(models.Source, { as: 'Arbiters', through: 'AssessmentArbiters' });
    models.Assessment.belongsTo(models.Assessment, { as: 'ParentAssessment' });
    models.Assessment.belongsTo(models.Assessment, { as: 'ParentComment' });
  };

  return Assessment;
};
