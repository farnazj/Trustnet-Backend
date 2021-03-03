var express = require('express');
var router = express.Router();
var Sequelize = require('sequelize');
var moment = require('moment');
var db  = require('../models');
var routeHelpers = require('../lib/routeHelpers');
var constants = require('../lib/constants');
var wrapAsync = require('../lib/wrappers').wrapAsync;
const Op = Sequelize.Op;
const { v4: uuidv4 } = require('uuid');

router.route('/posts') //initiated posts

.get(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  let paginationReq = routeHelpers.getLimitOffset(req);
  let authUser = await db.Source.findByPk(req.user.id);
  let posts = await authUser.getInitiatedPosts(paginationReq);

  res.send(posts);
}))

/*
when a source initiates a post, a credibility assessment is automatically generated
for the post, with the source as the sourceId and a value of "valid"
*/
.post(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  let authUser = await db.Source.findByPk(req.user.id);
  let postSpecs = {
    ...req.body,
    author: authUser.firstName + ' ' + authUser.lastName,
    publishedDate: moment.utc()
  }

  let post = await db.Post.create(postSpecs);
  await routeHelpers.initiatePost(authUser, post, false, req.body.target_usernames, req.body.target_lists);

  res.send({ message: 'Post has been added' });
}));


router.route('/posts/:post_id')

//TODO: need to change this if some posts become private
.get(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  let post = await db.Post.findByPk(req.params.post_id)
  res.send(post);
}))

.delete(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  await db.Post.destroy({
    where: {
      id: req.params.post_id,
      SourceId: req.user.id
    }
  })

  res.send({ message: 'Post deleted' });
}))

.put(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  let postSpecs = req.body;
  let post = await db.Post.findOne({
    where: {
      id: req.params.post_id,
      SourceId: req.user.id
      }
    });
  postSpecs.version = post.version + 1;
  await post.update(postSpecs);

  res.send({ message: 'Post updated' });
}));


router.route('/posts/:username')

.get(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  let paginationReq = routeHelpers.getLimitOffset(req);
  let source = await db.Source.findOne({where: {userName: req.params.username }});
  let results = await db.Post.findAndCountAll({
    where: {
      SourceId: source.id
    },
    ...paginationReq
  });

  res.send(results); //results.count, results.rows
}));


router.route('/posts/import')

.post(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  let authUser = await db.Source.findByPk(req.user.id);
  let assessmentObj = {
    postCredibility: req.body.postCredibility,
    body: req.body.assessmentBody,
    isTransitive: false
   };

  await routeHelpers.importPost(req.body.postUrl, authUser,
     assessmentObj, req.body.target_usernames);

  res.send({ message: 'Post has been imported' });
}));


router.route('/posts/:post_id/seen-status')

.post(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  let authUserProm = db.Source.findByPk(req.user.id);
  let postProm = db.Post.findByPk(req.params.post_id);
  let [post, authUser] = await Promise.all([postProm, authUserProm]);

  if (req.body.seen_status == constants.SEEN_STATUS.SEEN)
    post.addSeer(authUser);
  else if (req.body.seen_status == constants.SEEN_STATUS.NOTSEEN)
    post.removeSeer(authUser);

  res.sendStatus(200);
}))

.get(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  let post = await db.Post.findByPk(req.params.post_id);

  if (post) {
    let seers = await post.getSeers({
      where: {
        id: req.user.id
      }
    });
    if (seers.length)
      res.send({ seen: true });
    else
      res.send({ seen: false });
  }
  else {
    res.send({ message: 'Post not found' });
  }

}))


module.exports = router;
