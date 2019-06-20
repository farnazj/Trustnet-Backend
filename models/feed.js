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
    lastUpdated: {
      type: DataTypes.DATE
    },
    frequency: {
      type: DataTypes.INTEGER
    }
  });

  Feed.associate = function (models) {
    models.Feed.belongsTo(models.Source, {as: 'FeedSource'});
  };

  return Feed;
};
