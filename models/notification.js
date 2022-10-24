'use strict';

module.exports = (sequelize, DataTypes) => {
  const Notification = sequelize.define('Notification', {
    text: {
      type: DataTypes.TEXT('long')
    },
    link: {
        type: DataTypes.TEXT('medium'),
        // validate:{
        //    isUrl: true
        // }
    },
    seen: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    clicked: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    }

  }, {
    charset: 'utf8mb4',
  });


  Notification.associate = function (models) {
    models.Notification.belongsTo(models.Source, {as: 'NotificationTarget' });
  };

  return Notification;
};
