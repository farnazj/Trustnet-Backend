'use strict';

module.exports = (sequelize, DataTypes) => {
  const Token = sequelize.define('VerificationToken', {
    token: {
       type: DataTypes.STRING,
       allowNull: false
     }
  });


  Token.associate = function (models) {
    models.VerificationToken.belongsTo(models.Source);
  };

  return Token;
};
