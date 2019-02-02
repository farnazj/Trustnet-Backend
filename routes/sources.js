var express = require('express');
var router = express.Router();
var db  = require('../models');
var routeHelpers = require('../lib/routeHelpers');
var wrapAsync = require('../lib/wrappers').wrapAsync;


router.route('/sources')

.get(function(req, res){

  let pagination_req = routeHelpers.getLimitOffset(req);

  db.Source.findAndCountAll(pagination_req)
  .then( result => {
    res.send(result); //result.count, result.rows
  }).catch(err => {
    res.send(err);
  });
})

.post(function(req, res) {

  let sourceSpecs = routeHelpers.getSpecifictions(req.body);

  db.Source.create(sourceSpecs).then(function() {
    res.redirect('/');
  }).catch(err => {
    res.send(err);
  });
});


router.route('/sources/ids/:id')
.get(function(req, res) {

  db.Source.findById(req.params.id
  ).then(result =>{
    res.send(result);
  }).catch(err => res.send(err));
})


router.route('/sources/:username')

.get(function(req, res) {

  db.Source.findOne({where: {userName: req.params.username}}
  ).then(result =>{
    res.send(result);
  }).catch(err => res.send(err));
})

.delete(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  await db.Source.destroy({
    where: {
      userName: req.params.username
    }
  })

  res.redirect('/');
}))

.put(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  let sourceSpecs = routeHelpers.getSpecifictions(req.body);

  let result = await db.Source.update(
    sourceSpecs,
    { where: {userName: req.params.username} }
  );
  res.send(result);
}));



module.exports = router;
