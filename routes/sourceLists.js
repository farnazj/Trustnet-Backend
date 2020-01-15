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
  let lists = await db.SourceList.findAll({
    where: {
      SourceId: req.user.id
    },
    include: [{
      model: db.Source,
      as: 'ListEntities',
      attributes: ['id']
    }],
    order: [['name', 'ASC']],
    ...paginationReq
  })

  res.send(lists);
}))

//create a new list
.post(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  let authUserProm = db.Source.findByPk(req.user.id);
  let sourceListProm = db.SourceList.create({ name: req.body.name });

  let [authUser, sourceList] = await Promise.all([authUserProm, sourceListProm]);
  await sourceList.setListOwner(authUser);

  res.send({ message: 'Source list created' });
}));


router.route('/lists/:list_id')

.get(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  let paginationReq = routeHelpers.getLimitOffset(req);
  let sources = await db.Source.findAll({
    include: [{
      model: db.SourceList,
      as: 'EntityLists',
      where: {
        id: req.params.list_id,
        SourceId: req.user.id
      }
    }],
    ...paginationReq
  })

  res.send(sources);
}))

.put(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  await db.SourceList.update({
    name: req.body.name,
    where: {
      id: req.params.list_id,
      SourceId: req.user.id
      }
    });

  res.send({ message: 'List updated' });
}))

.delete(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  await db.SourceList.destroy({
    where: {
      id: req.params.list_id,
      SourceId: req.user.id
    }
  });

  res.send({ message: 'Source list deleted' });
}));


//Those sources that the auth user blocks
router.route('/lists/:list_id/add-source')

.post(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  let listedSourceProm = db.Source.findAll({
    where: {
      userName: req.body.username,
    }
  });
  let listProm = db.SourceList.findByPk(req.params.list_id);
  let [list, listedSource] = await Promise.all([listProm, listedSourceProm]);

  list.addListEntities(listedSource);

  res.send({ message: 'Sources added to the list' });
}));

router.route('/lists/:list_id/remove-source')
.post(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  let listedSourceProm = db.Source.findAll({
    where: {
      userName: req.body.username,
    }
  });
  let listProm = db.SourceList.findByPk(req.params.list_id);
  let [list, listedSource] = await Promise.all([listProm, listedSourceProm]);
  list.removeListEntities(listedSource);

  res.send({ message: 'Source removed from the list' });
}));


module.exports = router;
