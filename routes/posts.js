var express = require('express');
var router = express.Router();
var Sequelize = require('sequelize');
var db  = require('../models');
var routeHelpers = require('../lib/routeHelpers');
var boostHelpers = require('../lib/boostHelpers');
var constants = require('../lib/constants');
var wrapAsync = require('../lib/wrappers').wrapAsync;
const Op = Sequelize.Op;
const uuidv4 = require('uuid/v4');

router.route('/posts') //initiated posts

.get(routeHelpers.isLoggedIn, wrapAsync(async function(req, res){

  let pagination_req = routeHelpers.getLimitOffset(req);
  let auth_user = await db.Source.findByPk(req.user.id);
  let posts = await auth_user.getInitiatedPosts(pagination_req);
  res.send(posts);
}))

.post(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  let post_prom = db.Post.create(req.body);
  let auth_user_prom = db.Source.findByPk(req.user.id);

  //when a source initiates a post, a credibility assessment is automatically generated
  //for post, with the source as the sourceId and a value of "valid"

  let [auth_user, post] = await Promise.all([auth_user_prom, post_prom]);
  await routeHelpers.initiatePost(auth_user, post, req.body.target_usernames);

  res.send({message: 'Post has been added'});
}));


router.route('/posts/:post_id')

//TODO: need to change this if some posts become private
.get(routeHelpers.isLoggedIn, wrapAsync(async function(req, res){

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

  res.send({message: 'Post deleted'});
}))


.put(routeHelpers.isLoggedIn, function(req, res){

    let postSpecs = req.body;

    db.Post.findByPk(req.params.post_id)
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
  let pagination_req = routeHelpers.getLimitOffset(req);

  db.Source.findOne({where: {userName: req.params.username }})
  .then(source => {
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

  let auth_user = await db.Source.findByPk(req.user.id);
  let assessment_obj = {
    postCredibility: req.body.postCredibility,
    body: req.body.assessmentBody,
    isTransitive: false
   };

  await routeHelpers.importPost(auth_user, req.body.postUrl,
     assessment_obj, req.body.target_usernames);

  res.send({message: 'Post has been imported'});
}));


router.route('/posts/:post_id/seen-status')

.post(routeHelpers.isLoggedIn, wrapAsync(async function(req, res){

  let auth_user_prom = db.Source.findByPk(req.user.id);
  let post_prom = db.Post.findByPk(req.params.post_id);
  let [post, auth_user] = await Promise.all([post_prom, auth_user_prom]);
  if (req.body.seen_status == constants.SEEN_STATUS.SEEN)
    post.addSeer(auth_user);
  else if (req.body.seen_status == constants.SEEN_STATUS.NOTSEEN)
    post.removeSeer(auth_user);

  res.sendStatus(200);
}))

.get(routeHelpers.isLoggedIn, wrapAsync(async function(req, res){
  let post = await db.Post.findByPk(req.params.post_id);

  if (post) {
    let seers = await post.getSeers({where: {
      id: req.user.id
    }});
    if (seers.length)
      res.send({seen: true});
    else
      res.send({seen: false});
  }
  else {
    res.send({message: 'Post not found'});
  }

}))

//edit a title by posting a new version of it
router.route('/posts/:post_id/custom-titles/:set_id')
.post(routeHelpers.isLoggedIn, wrapAsync(async function(req, res){

  console.log(req.params.set_id, req.params.post_id)
  let custom_titles = await db.CustomTitle.findAll({
    where: {
      setId: req.params.set_id,
      sourceId: req.user.id
    },
    order: [
      [ 'version', 'DESC'],
    ]
  });

  console.log(custom_titles)

  if (custom_titles.length) {
    let update_proms = [];
    for (let title of custom_titles)
      update_proms.push(title.update({ version: title.version - 1}));

    let auth_user_prom = db.Source.findByPk(req.user.id);
    let post_prom = db.Post.findByPk(req.params.post_id);
    let titleSpecs = req.body;
    titleSpecs.setId = req.params.set_id;
    let title_prom = db.CustomTitle.create(titleSpecs);

    let [post, auth_user, title] = await Promise.all([post_prom, auth_user_prom, title_prom]);

    let source_title = auth_user.addSourceCustomTitles(title);
    let post_title = post.addPostCustomTitle(title);

    await Promise.all([source_title, post_title, ...update_proms]);
    res.send({ message: 'Title updated' });
  }
  else {
    res.send({ message: 'Title does not exist' })
  }

}))

.delete(routeHelpers.isLoggedIn, wrapAsync(async function(req, res){

  let delete_proms = db.CustomTitle.destroy({
    where: {
      setId: req.params.set_id,
      sourceId: req.user.id
    }
  });

  console.log('delete proms', delete_proms)
  if (delete_proms.length) {
    await Promise.all(delete_proms);
    res.send({ message: 'Title deleted' });
  }
  else {
    res.send({ message: 'Title does not exist' })
  }

}))

router.route('/posts/:post_id/custom-titles')

.post(routeHelpers.isLoggedIn, wrapAsync(async function(req, res){

  let auth_user_prom = db.Source.findByPk(req.user.id);
  let post_prom = db.Post.findByPk(req.params.post_id);
  let titleSpecs = req.body;
  titleSpecs.setId = uuidv4();
  let title_prom = db.CustomTitle.create(titleSpecs);

  let [post, auth_user, title] = await Promise.all([post_prom, auth_user_prom, title_prom]);

  let source_title = auth_user.addSourceCustomTitles(title);
  let post_title = post.addPostCustomTitle(title);

  await Promise.all([source_title, post_title]);
  res.send({message: 'Title posted'});

}))

router.route('/posts/:post_id/:user_id/custom-titles')

.get(routeHelpers.isLoggedIn, wrapAsync(async function(req, res){

  let titles = await db.CustomTitle.findAll({
    where: {
      SourceId: req.params.user_id,
      PostId: req.params.post_id
    },
    order: [
      ['setId', 'DESC'],
      [ 'version', 'DESC']
    ]
  });

  res.send(titles);
}))

//get custom titles from the auth_user's perspective
router.route('/posts/:post_id/custom-titles')

.get(routeHelpers.isLoggedIn, wrapAsync(async function(req, res){

  let post = await db.Post.findByPk(req.params.post_id);
  let [boosters_ids, cred_sources, followed_trusted_ids] = await boostHelpers.getBoostersandCredSources(req);

  let titles = await db.CustomTitle.findAll({
    include: [{
      model: db.Source,
      as: 'Endorsers',
    }],
    where: {
      SourceId: {
        [Op.or]: {
          [Op.eq]: Sequelize.col('CustomTitle.SourceId'),
          [Op.in]: followed_trusted_ids.concat(post.SourceId)
        }
      },
      PostId: req.params.post_id
    },
    order: [
      ['setId', 'DESC'],
      [ 'version', 'DESC']
    ]
  });

  res.send(titles);
}));

//if auth user has endorsed a custom title
router.route('/posts/:set_id/is-custom-title-endorsed')

.get(routeHelpers.isLoggedIn, wrapAsync(async function(req, res){

  let title = await db.CustomTitle.findOne({
    include: [{
      model: db.Source,
      as: 'Endorsers',
      where: {
        id: req.user.id
      }
    }],
    where: {
      setId: req.params.set_id
    }
  });

  console.log("^^^^^^^^^^",title)
  let result = title ? true : false;
  console.log("^^^^^^^^^^",result)
  res.send({ message: result });
}))

router.route('/posts/:set_id/custom-title-endorsers')

.get(routeHelpers.isLoggedIn, wrapAsync(async function(req, res){

  let [boosters_ids, cred_sources, followed_trusted_ids] = await boostHelpers.getBoostersandCredSources(req);

  let title = await db.CustomTitle.findOne({
    include: [{
      model: db.Source,
      as: 'Endorsers',
      where: {
        SourceId: {
          [Op.in]: followed_trusted_ids
        }
      }
    }],
    where: {
      setId: req.params.set_id
    }
  });

  console.log(title.Endorsers)
  res.send(title.Endorsers);
}))


module.exports = router;
