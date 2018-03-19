var express = require('express');
var router = express.Router();
var models  = require('../models');
var routeHelpers = require('../helpers/routeHelpers');


router.route('/posts')

.get(function(req, res){
  let offset_ = req.body.offset;
  let limit_ = req.body.limit_;

  models.Post.findAndCountAll({
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

  models.Post.create(sourceSpecs).then(function() {
    res.redirect('/');
  }).catch(err => {
    res.send(err);
  });
});


router.route('/posts/:post_id')

.get(function(req, res){

  models.Post.findById(req.params.post_id).then(result =>{
    res.send(result);
  }).catch(err => res.send(err));
})

.delete(function(req, res) {
  models.Post.destroy({
    where: {
      id: req.params.post_id
    }
  }).then(function() {
    res.redirect('/');
  }).catch(function(err){
    res.send(err);
  });
})

.put(function(req, res){

    let postSpecs = routeHelpers.getSpecifictions(req.body);

    models.Post.update(postSpecs, {where: {id: req.params.post_id}
    }).then(result =>{
      res.redirect('/');

    }).catch(err => res.send(err));
});


module.exports = router;
