'use strict';
/*
Any instance of HeadlineStatus which is created is because the hash of the text
of a standaloneTitle matched the hashes sent by the extension

*/

module.exports = (sequelize, DataTypes) => {
  const HeadlineStatus = sequelize.define('HeadlineStatus', {
    //whether the hashes sent by the extension matched the hash of the title
    // isFetched: { 
    //   type: DataTypes.BOOLEAN
    // },
    /*
    whether the text of the standaloneTitle was actually the text that the extension
    had encountered (checked upon fetching the candidate standaloneTitles from the server)
    */
    isEncountered: { 
        type: DataTypes.BOOLEAN
    },
    /*
    whether the alt headlines should not be displayed to the user, as part of the experiment
    */
   isWithheld: {
        type: DataTypes.BOOLEAN
   }
  }, {
    charset: 'utf8mb4',
  });

  HeadlineStatus.associate = function (models) {
    models.HeadlineStatus.belongsTo(models.Source);
    models.HeadlineStatus.belongsTo(models.StandaloneTitle);
  };

  return HeadlineStatus;
};
