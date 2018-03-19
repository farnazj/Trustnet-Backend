var express = require('express');
var router = express.Router();
var models  = require('../models');
var routeHelpers = require('../helpers/routeHelpers');


router.route('/sources')

.get(function(req, res){
  let offset_ = req.body.offset;
  let limit_ = req.body.limit_;

  models.Source.findAndCountAll({
    offset: offset_,
    limit: limit_
   }).then( result => {
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

.delete(function(req, res) {

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

.put(function(req, res) {

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

  let offset_ = req.body.offset;
  let limit_ = req.body.limit_;

  models.Source.findOne( {where: {userName: req.params.username }}
  ).then(source => {
     return models.Post.findAndCountAll({ where: {SourceId: source.id},
      offset: offset_,
      limit: limit_
    })
  }).then( result => {
    res.send(result); //result.count, result.rows
  }).catch(err => {
    res.send(err);
  });
})


// .post(function(req, res){
//   let postSpecs = routeHelpers.getSpecifictions(req.body);
//
//   models.Source.findOne( {where: {userName: req.params.username }}
//   ).then(source => {
//     postSpecs.SourceId = source.id;
//     return models.Post.create(postSpecs);
//
//   }).then( result => {
//     res.redirect('/');
//   }).catch(err => {
//     res.send(err);
//   });
// });


module.exports = router;
