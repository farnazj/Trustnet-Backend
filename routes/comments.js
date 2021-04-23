var express = require('express');
var router = express.Router();
var Sequelize = require('sequelize');
var db  = require('../models');
var routeHelpers = require('../lib/routeHelpers');
var boostHelpers = require('../lib/boostHelpers');
var constants = require('../lib/constants');
var utils = require('../lib/util');
var wrapAsync = require('../lib/wrappers').wrapAsync;
const Op = Sequelize.Op;
const { v4: uuidv4 } = require('uuid');
const { EmptyResultError } = require('sequelize');

router.route('/comments/:set_id')
.get(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {
    let comments = await db.Comment.findAll({
        where: {
            setId: req.params.set_id
        }
    });

    res.send(comments);
}));


router.route('/comments/post/:post_id')
.get(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {
    let relations = await boostHelpers.getBoostersandCredSources(req);
    let viewableSources = relations.followedTrusteds.concat(post.SourceId);

    let post = await db.Post.findByPk(req.params.post_id);
  
    let comments = await db.Comment.findAll({
        where: {
            PostId: req.params.post_id,
            SourceId: {
                [Op.or]: {
                    [Op.eq]: post.SourceId,
                    [Op.in]: viewableSources
                  }
            }
        }
    })

    res.send(comments);
}));

/*
editing a previously posted comment
accepts 
*/
router.route('/comments/:set_id')
.post(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {
    let prevComments = await db.Comment.findAll({
        where: {
            setId: req.params.set_id,
            SourceId: req.user.id
        },
        include: [{
            model: db.Post
        }]
    });

    if (!prevComments.length) {
        res.status(403).send({ message: 'Comment set does not exist or does not belong to the user' });
    }
    else {
        let prevCommentsProms = prevComments.map(comment => {
            return comment.update({
                version: comment.version - 1
            })
        })

        let commentProm = db.Comment.create({
            setId: req.params.set_id,
            version: 1,
            body: req.body.body
        });

        let authUserProm = db.Source.findByPk(req.user.id);

        let [comment, authUser] = await Promise.all([ commentProm, authUserProm ]);
        await Promise.all([ comment.setSource(authUser), comment.setPost(prevComments.Post), prevCommentsProms ]);
        res.send( { message: 'Comment updated'} );
    }
}))

/*
posting a new comment
*/
router.route('/comments/:post_id')
.post(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

    let commentProm = db.Comment.create({
        body: req.body.body,
        setId: uuidv4(),
        version: 1
    });
    let authUserProm = db.Source.findByPk(req.user.id);
    let postProm = db.Post.findByPk(req.params.post_id);

    let [comment, authUser, post] = await Promise.all([ commentProm, authUserProm, postProm ]);
    await Promise.all( [comment.setSource(authUser), comment.setPost(post) ]);
    res.send({ message: 'Comment posted', data: comment })
}))


module.exports = router;
