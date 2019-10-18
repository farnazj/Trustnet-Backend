var Sequelize = require('sequelize');
var db  = require('../models');
var constants = require('../lib/constants');
const logger = require('../lib/logger');
const Op = Sequelize.Op;

async function removeExpiredTokensAccounts() {

  db.Token.destroy({
    where: {
      tokenType: constants.TOKEN_TYPES.RECOVERY,
      expires: { [Op.lte]: Date.now() }
    }
  });

  let vTokens = await db.Token.findAll({
    where: {
      tokenType: constants.TOKEN_TYPES.VERIFICATION,
      expires: { [Op.lte]: Date.now() }
    },
    include: [{
      model: db.Source
    }]
  });

  vTokens.forEach(token => {
    token.Source.destroy();
    token.destroy();
  })
}

module.exports = {
  removeExpiredTokensAccounts
}
