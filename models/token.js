'use strict';

module.exports = (sequelize, DataTypes) => {
  const Token = sequelize.define('Token', {
    tokenStr: {
       type: DataTypes.STRING,
       allowNull: false
     },
     expires: {
       type: DataTypes.DATE
     },
     tokenType: {
       type: DataTypes.INTEGER
     }
  });


  Token.associate = function (models) {
    models.Token.belongsTo(models.Source);
  };

  return Token;
};
