var express = require('express');
var router = express.Router();
var Sequelize = require('sequelize');
var db  = require('../models');
var routeHelpers = require('../lib/routeHelpers');
var wrapAsync = require('../lib/wrappers').wrapAsync;
const Op = Sequelize.Op;
var kue = require('kue')
 , queue = kue.createQueue();

router.route('/sources')

.get(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  let paginationReq = routeHelpers.getLimitOffset(req);
  let searchTerm = req.headers.searchterm ? req.headers.searchterm : '';

  let whereClause = {
    [Op.or]: [
      db.sequelize.where(db.sequelize.fn('concat', db.sequelize.col('firstName'), ' ', db.sequelize.col('lastName')), {
        [Op.like]: '%' + searchTerm + '%'
      }),
        {
          userName: { [Op.like]: '%' + searchTerm + '%' }
        }
    ]
  }

  if (req.headers.followconstraint) {

    let authUser = await db.Source.findByPk(req.user.id);
    let followedIds = (await authUser.getFollows()).map(el => el.id);

    if (req.headers.followconstraint == 'followed') {
      whereClause = {
        [Op.and]: [
          whereClause,
          {
            id: {
              [Op.in]: followedIds
            }
          }
        ]
      }
    }
    else if (req.headers.followconstraint == 'not followed') {
      whereClause = {
        [Op.and]: [
          whereClause,
          {
            id: {
              [Op.notIn]: followedIds
            }
          }
        ]
      }
    }
  }

  let sources = await db.Source.findAll({
    where: whereClause,
    ...paginationReq
  });

  res.send(sources);
}))

.post(wrapAsync(async function(req, res) {

  let source = await db.Source.create(req.body);
  //queue.create('addNode', {sourceId: source.id}).priority('high').save();

  res.send({ message: 'Source created' });
}));


router.route('/sources/ids/:id')
.get(wrapAsync(async function(req, res) {

  let source = await db.Source.findByPk(req.params.id);
  res.send(source);
}));


router.route('/sources/:username')

.get(wrapAsync(async function(req, res) {

  let source = await db.Source.findOne({
    where: {
      userName: req.params.username
    },
    include: [{
      model: db.Feed,
      as: 'SourceFeeds'
    }]
  });

  res.send(source);
}))

.delete(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  await db.Source.destroy({
    where: {
      userName: req.params.username
    }
  })

  res.send({ message: 'Source deleted' });
}))

.put(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  let result = await db.Source.update(
    req.body,
    {
      where: {
        userName: req.params.username
      }
    }
  );

  res.send(result);
}));


module.exports = router;
