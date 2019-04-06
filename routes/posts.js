var express = require('express');
var router = express.Router();
var db  = require('../models');
var routeHelpers = require('../lib/routeHelpers');
var wrapAsync = require('../lib/wrappers').wrapAsync;
const Op = db.sequelize.Op;


router.route('/posts') //initiated posts

.get(routeHelpers.isLoggedIn, wrapAsync(async function(req, res){

  let pagination_req = routeHelpers.getLimitOffset(req);
  let auth_user = await db.Source.findById(req.user.id);
  let posts = await auth_user.getInitiatedPosts(pagination_req);
  res.send(posts);
}))

.post(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  let post_prom = db.Post.create(req.body);
  let auth_user_prom = db.Source.findById(req.user.id);

  //when a source initiates a post, a credibility assessment is automatically generated
  //for post, with the source as the sourceId and a value of "valid"

  let [auth_user, post] = await Promise.all([auth_user_prom, post_prom]);
  await routeHelpers.initiatePost(auth_user, post, req.body.target_usernames);

  res.send({message: 'Post has been added'});
}));


router.route('/posts/:post_id')

//TODO: need to change this if some posts become private
.get(routeHelpers.isLoggedIn, wrapAsync(async function(req, res){

  let post = await db.Post.findById(req.params.post_id)
  res.send(post);
}))

.delete(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {
  await db.Post.destroy({
    where: {
      id: req.params.post_id,
      SourceId: req.user.id
    }
  })

  res.send({message: 'Post deleted'});
}))


.put(routeHelpers.isLoggedIn, function(req, res){

    let postSpecs = req.body;

    db.Post.findById(req.params.post_id)
    .then(post => {
      postSpecs.version = post.version + 1;
      return post.update(postSpecs);
    })
    .then(result => {
      res.send({message: 'Post updated'});
    })
    .catch(err => res.send(err));
});


router.route('/posts/:username')

.get(routeHelpers.isLoggedIn, function(req, res){

  db.Source.findOne( {where: {userName: req.params.username }}
  ).then(source => {
     return db.Post.findAndCountAll({
       where: {
         SourceId: source.id
       },
       ...pagination_req
     })
  }).then( result => {
    res.send(result); //result.count, result.rows
  }).catch(err => {
    res.send(err);
  });
})


router.route('/posts/import')
.post(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  let auth_user = await db.Source.findById(req.user.id);
  let assessment_obj = {
    postCredibility: req.body.postCredibility,
    body: req.body.assessmentBody,
    isTransitive: false
   };

  await routeHelpers.importPost(auth_user, req.body.postUrl,
     assessment_obj, req.body.target_usernames);

  res.send({message: 'Post has been imported'});
}));


module.exports = router;
