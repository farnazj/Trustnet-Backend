var Sequelize = require('sequelize');
var express = require('express');
var router = express.Router();
var db  = require('../models');
var routeHelpers = require('../lib/routeHelpers');
var wrapAsync = require('../lib/wrappers').wrapAsync;
const Op = Sequelize.Op;


router.route('/lists')

.get(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  let paginationReq = routeHelpers.getLimitOffset(req);

  let authUser = await db.Source.findByPk(req.user.id);
  let lists = await authUser.getSourceLists(paginationReq);

  res.send(lists);
}))

//create a new list
.post(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  let authUserProm = db.Source.findByPk(req.user.id);
  let sourceListProm = db.SourceList.create({ name: req.body.name });


  let [authUser, sourceList] = await Promise.all([authUserProm, sourceListProm]);
  await authUser.addSourceList(sourceList);

  res.send({ message: 'Source list created' });
}))

.delete(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  await db.SourceList.destroy({
    where: {
      name: req.body.name,
      SourceId: req.user.id
    }
  });

  res.send({ message: 'Source list deleted' });
}));


//Those sources that the auth user blocks
router.route('/lists/:list_id/add-source')

.post(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  let listedSourceProm = db.Source.findOne({
    where: {
      userName: req.body.username,
      SourceId: req.user.id
    }
  });
  let listProm = db.SourceList.findByPk(req.params.list_id);
  let [list, listedSource] = await Promise.all([listProm, listedSourceProm]);
  list.addListEntity(listedSource);

  res.send({ message: 'Source added to the list' });
}));

router.route('/lists/:list_id/remove-source')
.post(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  let listedSourceProm = db.Source.findOne({
    where: {
      userName: req.body.username,
      SourceId: req.user.id
    }
  });
  let listProm = db.SourceList.findByPk(req.params.list_id);
  let [list, listedSource] = await Promise.all([listProm, listedSourceProm]);
  list.removeListEntity(listedSource);

  res.send({ message: 'Source removed from the list' });
}));


module.exports = router;
