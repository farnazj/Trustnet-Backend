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

  let postProm = db.Post.create(req.body);
  let authUserProm = db.Source.findByPk(req.user.id);
  let [authUser, post] = await Promise.all([authUserProm, postProm]);
  await routeHelpers.initiatePost(authUser, post, req.body.target_usernames, req.body.target_lists);

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

  await routeHelpers.importPost(authUser, req.body.postUrl,
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


//edit a title by posting a new version of it
router.route('/posts/:post_id/custom-titles/:set_id')

.post(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  let customTitles = await db.CustomTitle.findAll({
    where: {
      setId: req.params.set_id,
      sourceId: req.user.id
    },
    order: [
      [ 'version', 'DESC'],
    ]
  });


  if (customTitles.length) {

    let updateProms = [];
    let endorsers = [];

    for (let title of customTitles) {
      if (title.version == 1)
        endorsers = await title.getEndorsers();

      updateProms.push(title.update({ version: title.version - 1}));
    }

    let authUserProm = db.Source.findByPk(req.user.id);
    let postProm = db.Post.findByPk(req.params.post_id);
    let titleSpecs = req.body;
    titleSpecs.setId = req.params.set_id;
    let titleProm = db.CustomTitle.create(titleSpecs);

    let [post, authUser, title] = await Promise.all([postProm, authUserProm, titleProm]);

    let sourceTitle = authUser.addSourceCustomTitles(title);
    let postTitle = post.addPostCustomTitle(title);
    let addEndorsers = title.addEndorsers(endorsers);

    await Promise.all([sourceTitle, postTitle, addEndorsers, ...updateProms]);

    res.send({ message: 'Title updated' });
  }
  else {
    res.send({ message: 'Title does not exist' })
  }

}))

.delete(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  let deleteProms = db.CustomTitle.destroy({
    where: {
      setId: req.params.set_id,
      SourceId: req.user.id
    }
  });

  if (deleteProms.length) {
    await Promise.all(deleteProms);
    res.send({ message: 'Title deleted' });
  }
  else {
    res.send({ message: 'Title does not exist' })
  }

}));


router.route('/posts/:post_id/custom-titles')

.post(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  let authUserProm = db.Source.findByPk(req.user.id);
  let postProm = db.Post.findByPk(req.params.post_id);
  let titleSpecs = req.body;
  titleSpecs.setId = uuidv4();
  let titleProm = db.CustomTitle.create(titleSpecs);

  let [post, authUser, title] = await Promise.all([postProm, authUserProm, titleProm]);

  let sourceTitle = authUser.addSourceCustomTitles(title);
  let postTitle = post.addPostCustomTitle(title);

  await Promise.all([sourceTitle, postTitle]);
  res.send({ message: 'Title posted' });

}))


router.route('/posts/:post_id/:user_id/custom-titles')

.get(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

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

.get(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  let post = await db.Post.findByPk(req.params.post_id);
  let [boostersIds, credSources, followedTrustedIds] = await boostHelpers.getBoostersandCredSources(req);

  let titles = await db.CustomTitle.findAll({
    include: [{
      model: db.Source,
      as: 'Endorsers',
    }],
    where: {
      SourceId: {
        [Op.in]: followedTrustedIds.concat(post.SourceId)
        /*
        [Op.or]: {
          [Op.eq]: Sequelize.col('CustomTitle.SourceId'),
          [Op.in]: followedTrustedIds.concat(post.SourceId)
        }
        */
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


router.route('/posts/:set_id/custom-title-endorsement')

//if auth user has endorsed a custom title
.get(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  let title = await db.CustomTitle.findOne({
    include: [{
      model: db.Source,
      as: 'Endorsers',
      where: {
        id: req.user.id
      }
    }],
    where: {
      setId: req.params.set_id,
      version: 1
    }
  });

  let result = title ? true : false;

  res.send(result);
}))


.post(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  let authUserProm = db.Source.findByPk(req.user.id);
  let titleProm = db.CustomTitle.findOne({
    where: {
      setId: req.params.set_id,
      version: 1
    }
  });

  let [authUser, title] = await Promise.all([authUserProm, titleProm]);
  if (req.body.endorse_status == true)
    await title.addEndorser(authUser);
  else
    await title.removeEndorser(authUser);

  res.send({ message: 'Endorsement value changed' });
}));



router.route('/posts/:set_id/custom-title-endorsers')

.get(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  let [boostersIds, credSources, followedTrustedIds] = await boostHelpers.getBoostersandCredSources(req);

  let title = await db.CustomTitle.findOne({
    include: [{
      model: db.Source,
      as: 'Endorsers',
      where: {
        SourceId: {
          [Op.in]: followedTrustedIds
        }
      }
    }],
    where: {
      setId: req.params.set_id
    }
  });

  console.log(title.Endorsers)
  res.send(title.Endorsers);
}));


module.exports = router;
