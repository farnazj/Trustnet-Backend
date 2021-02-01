var express = require('express');
var router = express.Router();
var Sequelize = require('sequelize');
var moment = require('moment');
var db  = require('../models');
var routeHelpers = require('../lib/routeHelpers');
var boostHelpers = require('../lib/boostHelpers');
var constants = require('../lib/constants');
var wrapAsync = require('../lib/wrappers').wrapAsync;
const Op = Sequelize.Op;
const { v4: uuidv4 } = require('uuid');

router.route('/custom-title-endorsement/user/:set_id')

//if auth user has endorsed a custom title
.get(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  let title = await db.CustomTitle.findOne({
    include: [{
      model: db.Source,
      as: 'Endorsers',
      where: {
        id: req.user.id
      }
    }],
    where: {
      setId: req.params.set_id,
      version: 1
    }
  });

  let result = title ? true : false;

  res.send(result);
}))


.post(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  let authUserProm = db.Source.findByPk(req.user.id);
  let titleProm = db.CustomTitle.findOne({
    where: {
      setId: req.params.set_id,
      version: 1
    }
  });

  let [authUser, title] = await Promise.all([authUserProm, titleProm]);
  if (req.body.endorse_status == true)
    await title.addEndorser(authUser);
  else
    await title.removeEndorser(authUser);

  res.send({ message: 'Endorsement value changed' });
}));


router.route('/custom-title-endorsement/:set_id')

.get(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  let relations = await boostHelpers.getBoostersandCredSources(req);
  let titleSources = relations.followedTrusteds.concat(post.SourceId);

  let title = await db.CustomTitle.findOne({
    include: [{
      model: db.Source,
      as: 'Endorsers',
      where: {
        SourceId: {
          [Op.in]: titleSources
        }
      }
    }],
    where: {
      setId: req.params.set_id
    }
  });

  res.send(title.Endorsers);
}));



module.exports = router;