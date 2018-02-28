var models  = require('../models');
var express = require('express');
var router = express.Router();


function getSpecifictions(req_fields){

  let specifications = {};
  for (let key of Object.keys(req_fields)){
    specifications[key] = req_fields[key];
  }
  return specifications
}


router.post('/create', function(req, res) {

  let sourceSpecs = getSpecifictions(req.body);

  models.Source.create(sourceSpecs).then(function() {
    res.redirect('/');
  }).catch(function(err){
    console.log(err);
    res.send(err);
  });
});


router.delete('/:source_id/destroy', function(req, res) {
  models.Source.destroy({
    where: {
      id: req.params.source_id
    }
  }).then(function() {
    res.redirect('/');
  }).catch(function(err){
    res.send(err);
  });
});


router.post('/:source_id/posts/initiate', function (req, res) {
  let postSpecs = getSpecifictions(req.body);
  postSpecs.SourceId = req.params.source_id;

  models.Post.create(postSpecs).then(function() {
    res.redirect('/');
  });
});


module.exports = router;
