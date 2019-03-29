var express = require('express');
var router = express.Router();
var db  = require('../models');
var routeHelpers = require('../lib/routeHelpers');
var wrapAsync = require('../lib/wrappers').wrapAsync;
const Op = db.sequelize.Op;

//Those sources that the auth user follows
router.route('/follows')

.get(routeHelpers.isLoggedIn, function(req, res){

  let pagination_req = routeHelpers.getLimitOffset(req);

  db.Source.findById(req.user.id)
  .then(user => {
    return user.getFollows(
      pagination_req
    );
  }).then( result => {
    res.send(result);
  }).catch(err => {
    res.send(err);
  });

})

.post(routeHelpers.isLoggedIn, function(req, res) {

  let source_user = db.Source.findById(req.user.id);
  let followed_user = db.Source.findOne(
    {where: {userName: req.body.username}});

  Promise.all([source_user, followed_user])
  .then(sources => {
    return sources[0].addFollow(sources[1]);
  }).then(result => {
    res.send({message: 'Source added to follows'});
  }).catch(err => {
    res.send(err);
  });
})

.delete(routeHelpers.isLoggedIn, function(req, res) {

  let source_user = db.Source.findById(req.user.id);
  let followee_user = db.Source.findOne(
    {where: {userName: req.body.username}});

  Promise.all([source_user, followee_user])
  .then(sources => {
    return sources[0].removeFollow(sources[1]);
  }).then(result => {
    res.send({message: result + ' source removed from follows'});
  }).catch(err => {
    res.send(err)
  });
});


//Those sources that the auth user blocks
router.route('/blocks')

.get(routeHelpers.isLoggedIn, function(req, res){

  let pagination_req = routeHelpers.getLimitOffset(req);

  db.Source.findById(req.user.id)
  .then(user => {
    return user.getBlocks(
      pagination_req
    );
  }).then( result => {
    res.send(result);
  }).catch(err => {
    res.send(err);
  });
})

.post(routeHelpers.isLoggedIn, function(req, res) {

  let source_user = db.Source.findById(req.user.id);
  let blocked_user = db.Source.findOne(
    {where: {userName: req.body.username}});

  Promise.all([source_user, blocked_user])
  .then(sources => {
    return sources[0].addBlock(sources[1]);
  }).then(result =>{
    res.send({message: 'Source added to blocks'});
  }).catch(err => {
    res.send(err);
  });
})

.delete(routeHelpers.isLoggedIn, function(req, res) {

  let source_user = db.Source.findById(req.user.id);
  let blocked_user = db.Source.findOne(
    {where: {userName: req.body.username}});

  Promise.all([source_user, followee_user])
  .then(sources => {
    return sources[0].removeBlock(sources[1]);
  }).then(result => {
    res.send({message: result + ' source removed from blocks'});
  }).catch(err => {
    res.send(err)
  });
});


//Those sources that a specific user mutes
router.route('/mutes')

.get(routeHelpers.isLoggedIn, function(req, res){

  let pagination_req = routeHelpers.getLimitOffset(req);

  db.Source.findById(req.user.id)
  .then(user => {
    return user.getMutes(
      pagination_req
    );
  }).then(result => {
    res.send(result)
  }).catch(err => {
    res.send(err);
  });

})

.post(routeHelpers.isLoggedIn, function(req, res) {

  let source_user = db.Source.findById(req.user.id);
  let muted_user = db.Source.findOne(
    {where: {userName: req.body.username}});

  Promise.all([source_user, muted_user])
  .then(sources => {
    return sources[0].addMute(sources[1]);
  }).then(result =>{
    res.send({message: 'Source added to Mutes'});
  }).catch(err => {
    res.send(err);
  });
})

.delete(routeHelpers.isLoggedIn, function(req, res) {

  let source_user = db.Source.findById(req.user.id);
  let muted_user = db.Source.findOne(
    {where: {userName: req.body.username}});

  Promise.all([source_user, muted_user])
  .then(sources => {
    return sources[0].removeMute(sources[1]);
  }).then(result => {
    res.send({message: result + ' source removed from Mutes'});
  }).catch(err => {
    res.send(err)
  });
});

//Those sources that the auth user trusts
router.route('/trusts')

.get(routeHelpers.isLoggedIn, function(req, res) {

  let pagination_req = routeHelpers.getLimitOffset(req);

  db.Source.findById(req.user.id)
  .then(user => {
    return user.getTrusteds(
      pagination_req
    );
  }).then(result => {
    res.send(result);
  }).catch(err => {
    res.send(err);
  });

})

.post(routeHelpers.isLoggedIn, function(req, res) {

  let source_user = db.Source.findById(req.user.id);
  let trusted_user = db.Source.findOne(
    {where: {userName: req.body.username}});

  Promise.all([source_user, trusted_user])
  .then(sources => {
    return Promise.all([sources[0].addTrusted(sources[1]),
    sources[0].addFollow(sources[1])]);
  }).then(result =>{
    res.send({message: 'Source added to trusteds'});
  }).catch(err => {
    res.send(err);
  });
})


.delete(routeHelpers.isLoggedIn, function(req, res) {

  let source_user = db.Source.findById(req.user.id);
  let trusted_user = db.Source.findOne(
    {where: {userName: req.body.username}});

  Promise.all([source_user, trusted_user])
  .then(sources => {
    return sources[0].removeTrusted(sources[1]);
  }).then(result => {
    res.send({message: result + ' source removed from trusteds'});
  }).catch(err => {
    res.send(err)
  });
});

router.route('/followers/:username')

.get(routeHelpers.isLoggedIn, wrapAsync(async function(req, res){

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
