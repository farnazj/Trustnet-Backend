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
    lastFetched: {
      type: DataTypes.DATE
    },
    updateRate: {
      type: DataTypes.DOUBLE
    },
    priority: {
      type: DataTypes.DOUBLE
    }
  });

  Feed.associate = function (models) {
    models.Feed.belongsTo(models.Source, {as: 'FeedSource'});
  };

  return Feed;
};
