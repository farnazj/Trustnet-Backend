var express = require('express');
var router = express.Router();
var db  = require('../models');
var routeHelpers = require('../helpers/routeHelpers');
const Op = db.sequelize.Op;


router.route('/posts') //initiated posts

.get(routeHelpers.isLoggedIn, function(req, res){

  let pagination_req = routeHelpers.getLimitOffset(req);

  db.Source.findById(req.user.id)
  .then( user => {
    return user.getInitiatedPosts(pagination_req);
  }).then( result => {
    res.send(result);
  }).catch(err => {
    res.send(err);
  })

})

.post(routeHelpers.isLoggedIn, async function(req, res) {

  try{
    let post_specs = routeHelpers.getSpecifictions(req.body);

    let post_prom = db.Post.create(post_specs);
    let auth_user_prom = db.Source.findById(req.user.id);

    //when a source initiates a post, a credibility assessment is automatically generated
    //for post, with the source as the sourceId and a value of "valid"

    let [auth_user, post] = await Promise.all([auth_user_prom, post_prom]);

    await routeHelpers.initiatePost(auth_user, post);

    res.redirect('/');
  }
  catch(e){
    console.log(e);
    res.send(e);
  }

});



router.route( '/posts/:post_id')

//TODO: need to change this if some posts become private
.get(routeHelpers.isLoggedIn, function(req, res){

  db.Post.findById(req.params.post_id).then(result =>{
    res.send(result);
  }).catch(err => res.send(err));
})

.delete(routeHelpers.isLoggedIn, function(req, res) {
  db.Post.destroy({
    where: {
      id: req.params.post_id,
      SourceId: req.user.id
    }
  }).then(() => {
    res.redirect('/');
  }).catch(function(err){
    res.send(err);
  });
})


.put(routeHelpers.isLoggedIn, function(req, res){

    let postSpecs = routeHelpers.getSpecifictions(req.body);

    db.Post.findById(req.params.post_id)
    .then(post => {
      postSpecs.version = post.version + 1;
      return post.update(postSpecs);
    })
    .then(result =>{
      res.redirect('/');
    }).catch(err => res.send(err));
});


module.exports = router;
