'use strict';

module.exports = (sequelize, DataTypes) => {
  const Token = sequelize.define('RecoveryToken', {
    token: {
       type: DataTypes.STRING,
       allowNull: false
     },
     expires: {
       type: DataTypes.DATE
     }
  });


  Token.associate = function (models) {
    models.RecoveryToken.belongsTo(models.Source);
  };

  return Token;
};
