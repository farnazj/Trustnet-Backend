'use strict';

module.exports = (sequelize, DataTypes) => {
  const Feed = sequelize.define('Feed', {
    name: {
      type: DataTypes.STRING,
    },
    rssfeed: {
      type: DataTypes.STRING,
      isUrl: true
    },
     lastUpdated:{
       type: DataTypes.DATE
     }
  });

  return Feed;
};
