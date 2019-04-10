var express = require('express');
var router = express.Router();
var db  = require('../models');
var routeHelpers = require('../lib/routeHelpers');
var wrapAsync = require('../lib/wrappers').wrapAsync;
const Op = db.sequelize.Op;


router.route('/sources')

.get(function(req, res){

  let pagination_req = routeHelpers.getLimitOffset(req);
  let searchTerm = req.headers.searchterm ? req.headers.searchterm : '';

  db.Source.findAll({
    where: {
      [Op.or]: [
        db.sequelize.where(db.sequelize.fn('concat', db.sequelize.col('firstName'), ' ', db.sequelize.col('lastName')), {
          [Op.like]: '%' + searchTerm + '%'
        }),
          {
            userName: { [Op.like]: '%' + searchTerm + '%' }
          }
      ]
    },
    ...pagination_req
  })
  .then( result => {
    res.send(result);
  }).catch(err => {
    res.send(err);
  });
})

.post(function(req, res) {

  db.Source.create(req.body).then(function() {
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

  let result = await db.Source.update(
    req.body,
    { where: {userName: req.params.username} }
  );
  res.send(result);
}));


module.exports = router;
