var express = require('express');
var router = express.Router();
var db  = require('../models');
var routeHelpers = require('../lib/routeHelpers');
var boostHelpers = require('../lib/boostHelpers');
var wrapAsync = require('../lib/wrappers').wrapAsync;
var filterValidity = require('../lib/boostPatch');
var Sequelize = require('sequelize');
const Op = Sequelize.Op;
var constants = require('../lib/constants');
var db  = require('../models');

//get a boost from the auth_user's perspective
router.route('/boosts/posts/:post_id')

.get(routeHelpers.isLoggedIn, wrapAsync(async function(req, res){

  let exploreMode = req.headers.explore ? req.headers.explore == 'true' : false;

  let relations = await boostHelpers.getBoostersandCredSources(req);
  let postBoosts = await boostHelpers.getPostBoosts([req.params.post_id], req,
    relations, exploreMode, false);

  res.send(postBoosts[0]);
}));

router.route('/boosts/:boost_id')
.delete(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  await db.Boost.destroy({
    where: {
      SourceId: req.user.id,
      id: req.params.boost_id
    }
  });

  res.send({ message: 'Boost deleted' });
}));


router.route('/boosts')

.get(routeHelpers.isLoggedIn, wrapAsync(async function(req, res){

  let relations = await boostHelpers.getBoostersandCredSources(req);
  let exploreMode = req.headers.explore ? req.headers.explore == 'true' : false;

  if (exploreMode || (relations.boosters.length && relations.credSources.length)) {

    /*
    Finding newly created (unseen or seen & unseen) posts by the user to prepend to the boosts. Because
    other posts in the system are likely to have multiple boosts, the newly created post 
    may be downranked by the regular getPostBoosts call and need to be specifically selected.
    */
    let reqSeenStatus = req.headers.seenstatus ? req.headers.seenstatus.toLowerCase() : undefined;
    let unseenCreatedPostsIds = []
    if (reqSeenStatus != constants.SEEN_STATUS.SEEN) {
      let unseenCreatedPosts = await db.Post.findAll({
        where: {
          [Op.and]: [{
            SourceId: req.user.id,
          }, {
            '$Seers.id$': null
          }]
        },
        include: [{
          model: db.Source,
          as: 'Seers',
          where: {
            id: {
              [Op.or]: [{
                [Op.eq]: null
              }, {
                [Op.in]: [req.user.id]
              }]
            }
          },
          required: false, //left outer join
          through: {
            attributes: []
          }
        }]
      });

      unseenCreatedPostsIds = unseenCreatedPosts.map(el => el.id);
    }

    let [queryStr, replacements] = boostHelpers.buildBoostQuery(req, relations, exploreMode);

    let postIdObjs = await db.sequelize.query(queryStr,
    { replacements: replacements, type: Sequelize.QueryTypes.SELECT });

    let postIds = postIdObjs.map(el => el.id);
    let postBoostsProm = boostHelpers.getPostBoosts(postIds, req, relations, exploreMode, null);

    let unselectedUserCreatedPostIds = unseenCreatedPostsIds.filter(id => !postIds.includes(id));

    let unseenUserPostsProm = new Promise( (resolve, reject) => resolve([]));;
    if (unselectedUserCreatedPostIds.length) 
      unseenUserPostsProm = boostHelpers.getPostBoosts(unselectedUserCreatedPostIds, req, relations, 
        exploreMode, false);

    let results = await Promise.all([postBoostsProm, unseenUserPostsProm]);
    let postBoosts = results[0];
    let unseenUserPosts = results[1];

    res.send(unseenUserPosts.concat(postBoosts));
  }
  else
    res.send([]);
}))

.post(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  let authUserProm = db.Source.findByPk(req.user.id);
  let assessment = await db.Assessment.findOne({
    where: {
        SourceId: req.user.id,
        PostId: req.body.post_id
      }
  });

  if (!assessment)
      throw "Cannot boost the post before assessing its credibility: "
        + req.body.post_id + " user: " + req.user.id;

  let authUser = await authUserProm;

  await routeHelpers.boostPost(authUser, req.body.post_id, req.body.target_usernames,
    req.body.target_lists);

  res.send({}); //TODO: change
}));

module.exports = router;
