var express = require('express');
var router = express.Router();
var models  = require('../models');
var routeHelpers = require('../helpers/routeHelpers');


router.route('/sources')

.get(function(req, res){

  let pagination_req = routeHelpers.getLimitOffset(req);

  models.Source.findAndCountAll(pagination_req)
  .then( result => {
    res.send(result); //result.count, result.rows
  }).catch(err => {
    res.send(err);
  });
})

.post(function(req, res) {

  let sourceSpecs = routeHelpers.getSpecifictions(req.body);

  models.Source.create(sourceSpecs).then(function() {
    res.redirect('/');
  }).catch(err => {
    res.send(err);
  });
});


router.route('/sources/:username')

.get(function(req, res){

  models.Source.findOne({where: {userName: req.params.username}}
  ).then(result =>{
    res.send(result);
  }).catch(err => res.send(err));
})

.delete(routeHelpers.isLoggedIn, function(req, res) {

  models.Source.destroy({
    where: {
      userName: req.params.username
    }
  }).then(result => {
    res.redirect('/');
  }).catch(err => {
    res.send(err);
  });
})

.put(routeHelpers.isLoggedIn, function(req, res) {

  let sourceSpecs = routeHelpers.getSpecifictions(req.body);

  models.Source.update(
    sourceSpecs,
    { where: {userName: req.params.username} }
  ).then(result => {
    res.send(result);
  }).catch(err => {
    res.send(err);
  });
});


router.route('/sources/:username/posts')

.get(function(req, res){

  let pagination_req = routeHelpers.getLimitOffset(req);

  models.Source.findOne( {where: {userName: req.params.username }}
  ).then(source => {

    let specs = pagination_req;
    specs.where = {SourceId: source.id};
     return models.Post.findAndCountAll(specs)
  }).then( result => {
    res.send(result); //result.count, result.rows
  }).catch(err => {
    res.send(err);
  });
})


module.exports = router;
