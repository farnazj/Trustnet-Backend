var models = require('../models');
var express = require('express');
var router = express.Router();

// models.Source.findOrCreate({ where:{ username: 'farnaz', email:'farnaz@farnaz.com'}})
//   .then(() => models.Source.findOrCreate({where: {username: 'feri', email:'feri@feri.com' }}))
//   .spread((source, created) => {
//     console.log(source.get({
//       plain: true
//     }))
//     console.log(created)
//
//   });


/* GET home page. */

router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

module.exports = router;
