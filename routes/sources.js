var express = require('express');
var router = express.Router();
var Sequelize = require('sequelize');
var db  = require('../models');
var routeHelpers = require('../lib/routeHelpers');
var wrapAsync = require('../lib/wrappers').wrapAsync;
const Op = Sequelize.Op;
// var kue = require('kue')
//  , queue = kue.createQueue();

router.route('/sources')

/*
Headers (optional):
followconstraint: either 'followed' or 'not followed'
individual: either 'true' (for retrieving accounts belonging to individuals) or 'false' (for 
  retrieving accounts belonging to news media)
searchterm: a String
*/
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

    if (req.headers.individual) {
      
      let appendedWhere;

      if (req.headers.individual == 'true') {
        appendedWhere = {
          systemMade: 0
        }
      }
      else { //req.headers.individual == 'false'
        appendedWhere = {
          systemMade: 1,
          isVerified: 1
        }
      }

      whereClause = {
        [Op.and]: [
          whereClause,
          appendedWhere
        ]
      }
    }

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
    attributes: {
      include: [
        [Sequelize.fn('concat', db.sequelize.col('firstName'), ' ', db.sequelize.col('lastName')), 'Full_Name'],
      ]
    },
    where: whereClause,
    ...paginationReq,
    order: [
      [Sequelize.literal('Full_Name DESC')]
    ]
  });

  res.send(sources);
}))

.post(wrapAsync(async function(req, res) {

  let source = await db.Source.create(req.body);
  //queue.create('addNode', {sourceId: source.id}).priority('high').save();

  res.send({ message: 'Source created' });
}))

.put(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  let result = await db.Source.update(
    req.body,
    {
      where: {
        id: req.user.id
      }
    }
  );

  res.send(result);
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
}));


module.exports = router;
