'use strict';

module.exports = (sequelize, DataTypes) => {
  const AssessmentReason = sequelize.define('AssessmentReason', {
    body: {
        type: DataTypes.TEXT('long')
    },
    code: {
        type: DataTypes.INTEGER
    }
  }, {
    charset: 'utf8mb4',
  });

  return AssessmentReason;
};
