var express = require('express');
var router = express.Router();
var Sequelize = require('sequelize');
var db  = require('../models');
var routeHelpers = require('../lib/routeHelpers');
var constants = require('../lib/constants');
var wrapAsync = require('../lib/wrappers').wrapAsync;
const logger = require('../lib/logger');

const Op = Sequelize.Op;
// var kue = require('kue')
//  , queue = kue.createQueue();

router.route('/notifications')

.get(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

    let paginationReq = routeHelpers.getLimitOffset(req);
    let notificationsProm = db.Notification.findAll({
        where: {
            NotificationTargetId: req.user.id
        },
        ...paginationReq,
        order: [
            ['createdAt', 'DESC']
        ]
    });

    let notSeenNotifsProms = db.Notification.findAndCountAll({
        where: {
            seen: false,
            NotificationTargetId: req.user.id
            
        }
    });

    let [notifications, notSeenNotifs] = await Promise.all([notificationsProm, notSeenNotifsProms]);
    console.log('not seen', notSeenNotifs, '\n')

    res.send({ notifications: notifications, notSeenCount: notSeenNotifs.count });

}));

router.route('/notifications/:notif_id/seen-status')
.post(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

    let notification = await db.Notification.findOne({
        where: {
            NotificationTargetId: req.user.id,
            id: req.params.notif_id
        }
    })
  
    if (req.body.seen_status == constants.SEEN_STATUS.SEEN)
        notification.update({ seen: true });
    else if (req.body.seen_status == constants.SEEN_STATUS.NOTSEEN)
        notification.update({ seen: false });
  
    res.sendStatus(200);
}));

router.route('/notifications/:notif_id/clicked')
.post(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

    let notification = await db.Notification.findOne({
        where: {
            NotificationTargetId: req.user.id,
            id: req.params.notif_id
        }
    })
  
    notification.update({ clicked: true });
    res.sendStatus(200);
}));

module.exports = router;