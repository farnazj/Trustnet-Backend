var Sequelize = require('sequelize');
var express = require('express');
var router = express.Router();
var db  = require('../models');
var routeHelpers = require('../lib/routeHelpers');
var wrapAsync = require('../lib/wrappers').wrapAsync;
const Op = Sequelize.Op;
// var kue = require('kue')
//  , queue = kue.createQueue();

//Those sources that the auth user follows
router.route('/follows')

.get(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  let paginationReq = routeHelpers.getLimitOffset(req);

  let authUser = await db.Source.findByPk(req.user.id);
  let followeds = await authUser.getFollows(paginationReq);

  res.send(followeds);
}))

.post(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  let authUserProm = db.Source.findByPk(req.user.id);
  let followedUserProm = db.Source.findOne({
    where: {
      userName: req.body.username
    }
  });

  let [authUser, followedUser] = await Promise.all([authUserProm, followedUserProm]);
  await authUser.addFollow(followedUser);

  res.send({ message: 'Source added to follows' });
}))

.delete(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  let authUserProm = db.Source.findByPk(req.user.id);
  let followedUserProm = db.Source.findOne({
    where: {
      userName: req.body.username
    }
  });

  let [authUser, followedUser] = await Promise.all([authUserProm, followedUserProm]);
  await authUser.removeFollow(followedUser);

  res.send({ message: 'Source removed from follows' });
}));


//Those sources that the auth user blocks
router.route('/blocks')

.get(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  let paginationReq = routeHelpers.getLimitOffset(req);
  let authUser = await db.Source.findByPk(req.user.id);
  let blockeds = await authUser.getBlocks(
    paginationReq
  );

  res.send(blockeds);
}))

.post(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  let authUserProm = db.Source.findByPk(req.user.id);
  let blockedUserProm = db.Source.findOne({
    where: {
      userName: req.body.username
    }
  });

  let [authUser, blockedUser] = await Promise.all([authUserProm, blockedUserProm]);
  await authUser.addBlock(blockedUser);

  res.send({ message: 'Source added to blocks' });
}))

.delete(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  let authUserProm = db.Source.findByPk(req.user.id);
  let blockedUserProm = db.Source.findOne({
    where: {
      userName: req.body.username
    }
  });

  let [authUser, blockedUser] = await Promise.all([authUserProm, blockedUserProm]);
  await authUser.removeBlock(blockedUser);

  res.send({ message: 'Source removed from blocks' });
}));


//Those sources that a specific user mutes
router.route('/mutes')

.get(routeHelpers.isLoggedIn, wrapAsync(async function(req, res){

  let paginationReq = routeHelpers.getLimitOffset(req);

  let authUser = await db.Source.findByPk(req.user.id);
  let muteds = await authUser.getMutes(
    paginationReq
  );

  res.send(muteds);
}))

.post(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  let authUserProm = db.Source.findByPk(req.user.id);
  let mutedUserProm = db.Source.findOne({
    where: {
      userName: req.body.username
    }
  });

  let [authUser, mutedUser] = await Promise.all([authUserProm, mutedUserProm]);
  await authUser.addMute(mutedUser);

  res.send({ message: 'Source added to Mutes' });
}))

.delete(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  let authUserProm = db.Source.findByPk(req.user.id);
  let mutedUserProm = db.Source.findOne({
    where: {
      userName: req.body.username
    }
  });

  let [authUser, mutedUser] = await Promise.all([authUserProm, mutedUserProm]);
  await authUser.removeMute(mutedUser);

  res.send({ message: 'Source removed from Mutes' });
}));


//Those sources that the auth user trusts
router.route('/trusts')

.get(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  let paginationReq = routeHelpers.getLimitOffset(req);
  let authUser = await db.Source.findByPk(req.user.id);
  let trusteds = await authUser.getTrusteds(
      paginationReq
  );

  res.send(trusteds);
}))

.post(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  let authUserProm = db.Source.findByPk(req.user.id);
  let trustedUserProm = db.Source.findOne({
    where: {
      userName: req.body.username
    }
  });

  let [authUser, trustedUser] = await Promise.all([authUserProm, trustedUserProm]);
  await authUser.addTrusted(trustedUser);
  // queue.create('addEdge', {sourceId: authUser.id, targetId: trustedUser.id })
  // .priority('high').save();

  res.send({ message: 'Source added to trusteds' });
}))

.delete(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  let authUserProm = db.Source.findByPk(req.user.id);
  let trustedUserProm = db.Source.findOne({
    where: {
      userName: req.body.username
    }
  });

  let [authUser, trustedUser] = await Promise.all([authUserProm, trustedUserProm]);
  await authUser.removeTrusted(trustedUser);
  // queue.create('removeEdge', {sourceId: authUser.id, targetId: trustedUser.id })
  // .priority('high').save();

  res.send({ message: 'Source removed from trusteds' });
}));


router.route('/followers/:username')

.get(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  let user = await db.Source.findOne({
    where: {
      userName: req.params.username
    }
  });

  let followers = await db.Source.findAll({
    subQuery: false,
    include: [{
      model: db.Source,
      as: 'Follows',
      attributes: [],
      where: {
        id: {
          [Op.in]: [user.id]
        }
      }
    }],

    group: ['Source.id']
    //limit: req.query.limit ? parseInt(req.query.limit) : 15,
    //offset: req.query.offset ? parseInt(req.query.offset) : 0
  })

  res.send(followers);
}))

module.exports = router;
