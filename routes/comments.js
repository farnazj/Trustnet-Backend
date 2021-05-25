var express = require('express');
var router = express.Router();
var Sequelize = require('sequelize');
var db  = require('../models');
var routeHelpers = require('../lib/routeHelpers');
var boostHelpers = require('../lib/boostHelpers');
var constants = require('../lib/constants');
var wrapAsync = require('../lib/wrappers').wrapAsync;
const { v4: uuidv4 } = require('uuid');
const Op = Sequelize.Op;

router.route('/comments/sets/:set_id')
.get(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {
    let comments = await db.Comment.findAll({
        where: {
            setId: req.params.set_id
        }
    });

    res.send(comments);
}))

/*
editing a previously posted comment
expects req.body of the form:
{
  body: String
}
*/
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
deleting a comment destroys the instance but posts a new comment with an empty body in its place,
otherwise the replies would need to be deleted as well
*/
.delete(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {
    let comments = await db.Comment.findAll({
        where: {
            setId: req.params.set_id,
            SourceId: req.user.id
        },
        include: [{
            model: db.Post
        }]
    });

    if (!comments.length) {
        res.status(403).send({ message: 'Comment set does not exist or does not belong to the user' });
    }
    else {
        let dummyCommentProm = db.Comment.create({
            setId: uuidv4(),
            version: 1,
        });

        let commentIds = comments.map(el => el.id);

        let [childComments, childAssessments, dummyComment] = await Promise.all([ db.Comment.findAll({
            where: {
                ParentComment: {
                    [Op.in]: commentIds
                }
            }
        }),
        db.Assessment.findAll({
            where: {
                ParentComment: {
                    [Op.in]: commentIds
                }
            }
        }),
        dummyCommentProm ]);

        let children = [...childComments,...childAssessments];
        let associationProms = children.map(child => {
            child.setParentComment(dummyComment)
        })

        let destroyProms = comments.map(el => el.destroy());

        await Promise.all([...associationProms, ...destroyProms]);

        res.send( { message: 'Comment deleted'} );
    }
}))


router.route('/comments/posts/:post_id')
.get(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {
    let relations = await boostHelpers.getBoostersandCredSources(req);
    let post = await db.Post.findByPk(req.params.post_id);
    let viewableSources = relations.followedTrusteds.concat(post.SourceId);
  
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
}))

/*
posting a new comment
expects req.body of the form:
{
  body: String,
  repliesTo (optional): Number (id)
  repliesToType (optional): one of 1 for comment, 2 for assessment
}
*/
.post(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

    let commentProm = db.Comment.create({
        body: req.body.body,
        setId: uuidv4(),
        version: 1
    });

    let authUserProm = db.Source.findByPk(req.user.id);
    let postProm = db.Post.findByPk(req.params.post_id);

    let parentInstanceProm = new Promise((resolve) => resolve());

    if (req.body.repliesTo) { //if the comment is not a top level comment
        if (repliesToType == constants.COMMENT) {
            parentInstanceProm = db.Comment.findByPk(req.body.repliesTo);
        }
        else {
            parentInstanceProm = db.Assessment.findByPk(req.body.repliesTo);
        }
    }

    let [comment, authUser, post, parentInstance] = await Promise.all([ commentProm, authUserProm, postProm, parentInstanceProm ]);

    let parentAssociationProm = new Promise((resolve) => resolve());

    if (req.body.repliesTo) { //if the comment is not a top level comment
        if (repliesToType == constants.COMMENT) {
            parentAssociationProm = comment.setParentComment(parentAssociation);
        }
        else {
            parentAssociationProm = comment.setParentAssessment(parentAssociation);
        }
    }

    await Promise.all( [comment.setSource(authUser), comment.setPost(post), parentAssociationProm ]);
    res.send({ message: 'Comment posted', data: comment })
}));

module.exports = router;
