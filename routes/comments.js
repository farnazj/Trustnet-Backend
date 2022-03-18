var express = require('express');
var router = express.Router();
var Sequelize = require('sequelize');
var db  = require('../models');
var routeHelpers = require('../lib/routeHelpers');
var boostHelpers = require('../lib/boostHelpers');
var constants = require('../lib/constants');
var wrapAsync = require('../lib/wrappers').wrapAsync;
var notificationHelpers = require('../lib/notificationHelpers');
const { v4: uuidv4 } = require('uuid');
const Op = Sequelize.Op;


// Query Params: offset, limit
router.route('/comments/trees/:root_set_id')
.get(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {
    
    let paginationReq = routeHelpers.getLimitOffset(req);
    let comments = await db.Comment.findAll({
        where: {
            rootSetId: req.params.root_set_id,
            version: 1
        },
        include: {
            model: db.Source,
            attributes: {exclude: ['passwordHash', 'isVerified', 'createdAt', 'updatedAt']}
        },
        order: [
            ['createdAt', 'ASC']
        ],
        ...paginationReq
    });

    res.send(comments);
}))


router.route('/comments/sets/:set_id')
.get(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {
    let comments = await db.Comment.findAll({
        where: {
            setId: req.params.set_id
        },
        include: {
            model: db.Source
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
        let baseComment = prevComments[0]; // Pick an arbitrary comment from the set to extract the transitive associations and shared properties

        let prevCommentsProms = prevComments.map(comment => {
            return comment.update({
                version: comment.version - 1
            })
        })

        let commentProm = db.Comment.create({
            body: req.body.body,
            version: 1,
            setId: req.params.set_id,
            createdAt: baseComment.createdAt,
            parentType: baseComment.parentType,
            parentId: baseComment.parentId,
            parentSetId: baseComment.parentSetId,
            rootType: baseComment.rootType,
            rootSetId: baseComment.rootSetId
        });

        let authUserProm = db.Source.findByPk(req.user.id);

        let [comment, authUser] = await Promise.all([ commentProm, authUserProm ]);

        await Promise.all([ comment.setSource(authUser), comment.setPost(baseComment.Post), prevCommentsProms ]);

        res.send( { message: 'Comment edited', data: comment} );
    }
}))

/*
deleting a comment destroys the instance but posts a new comment with an empty body in its place,
otherwise the replies would need to be deleted as well
*/
.delete(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {
    const [COMMENT_TYPE, ASSESSMENT_TYPE] = [constants.COMMENT_ASSESSMENT_TYPES.COMMENT, constants.COMMENT_ASSESSMENT_TYPES.ASSESSMENT]

    let comments = await db.Comment.findAll({
        where: {
            setId: req.params.set_id,
            SourceId: req.user.id
        }
    }); // All comments in the selected set

    if (!comments.length) {
        res.status(403).send({ message: 'Comment set does not exist or does not belong to the user' });
    }
    else {
        let baseComment = comments[0]; // Pick an arbitrary comment from the set to extract the transitive associations and shared properties
        let dummyCommentProm = db.Comment.create({
            body: null,
            version: 1,
            setId: baseComment.setId,
            createdAt: baseComment.createdAt,
            parentType: baseComment.parentType,
            parentId: baseComment.parentId,
            parentSetId: baseComment.parentSetId,
            rootType: baseComment.rootType,
            rootSetId: baseComment.rootSetId
        });

        let commentIds = comments.map(el => el.id); // The ids of all comments in the selected set

        let [childComments, dummyComment] = await Promise.all([ db.Comment.findAll({
            where: {
                parentType: COMMENT_TYPE,
                parentId: {
                    [Op.in]: commentIds
                }
            }
        }),
        dummyCommentProm ]);

        let [commentPost, commentSource] = await Promise.all([
            db.Post.findByPk(baseComment.PostId),
            db.Source.findByPk(baseComment.SourceId)
        ])

        await Promise.all([ dummyComment.setPost(commentPost), dummyComment.setSource(commentSource) ]);

        let associationProms = childComments.map(child => {
            child.update({
                'parentId': dummyComment.id,
                'parentSetId': dummyComment.setId
            });
        })

        let destroyProms = comments.map(el => el.destroy());

        await Promise.all([...associationProms, ...destroyProms]);

        res.send( { message: 'Comment deleted', data: dummyComment} );
    }
}))


// Top-level comments only
router.route('/comments/posts/:post_id')
.get(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {
    let relations = await boostHelpers.getBoostersandCredSources(req);
    let post = await db.Post.findByPk(req.params.post_id);
    let viewableSources = relations.followedTrusteds.concat(post.SourceId);

    let paginationReq = routeHelpers.getLimitOffset(req);
  
    let comments = await db.Comment.findAll({
        where: {
            PostId: req.params.post_id,
            SourceId: {
                [Op.or]: {
                    [Op.eq]: post.SourceId,
                    [Op.in]: viewableSources
                  }
            },
            rootSetId: null,
            version: 1
        },
        include: {
            model: db.Source
        },
        order: [
            ['createdAt', 'ASC']
        ],
        ...paginationReq
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

    const [COMMENT_TYPE, ASSESSMENT_TYPE] = [constants.COMMENT_ASSESSMENT_TYPES.COMMENT, constants.COMMENT_ASSESSMENT_TYPES.ASSESSMENT]

    let commentProm = db.Comment.create({
        body: req.body.body,
        setId: uuidv4(),
        version: 1,

        parentType: null,
        parentId: null,
        parentSetId: null,
        rootType: null,
        rootSetId: null
    });

    let authUserProm = db.Source.findByPk(req.user.id);
    let postProm = db.Post.findByPk(req.params.post_id);

    let parentInstanceProm = new Promise((resolve) => resolve());

    if (req.body.repliesTo) { //if the comment is not a top level comment
        parentInstanceProm = (req.body.repliesToType == COMMENT_TYPE) ?
                             db.Comment.findByPk(req.body.repliesTo) :
                             db.Assessment.findByPk(req.body.repliesTo);
    }

    let [comment, authUser, post, parentInstance] = await Promise.all([ commentProm, authUserProm, postProm, parentInstanceProm ]);

    let parentAssociationProm = new Promise((resolve) => resolve());
    let rootAssocationProm = new Promise((resolve) => resolve());

    if (req.body.repliesTo) { //if the comment is not a top level comment
        parentAssociationProm = comment.update({
                'parentType': parseInt(req.body.repliesToType),
                'parentId': parentInstance.id,
                'parentSetId': req.body.repliesToType == COMMENT_TYPE ? parentInstance.setId : parentInstance.SourceId
        });

        if (req.body.repliesToType == ASSESSMENT_TYPE || parentInstance.rootType === null) { // Replied to a top-level, root is same as parent
            rootAssociationProm = comment.update({
                'rootType': parseInt(req.body.repliesToType),
                'rootSetId': req.body.repliesToType == COMMENT_TYPE ? parentInstance.setId : parentInstance.SourceId
            });
        }
        else { // Replied to a non-top-level, root is same as root of parent
            rootAssociationProm = comment.update({
                'rootType': parentInstance.rootType,
                'rootSetId': parentInstance.rootSetId
            });
        }
    }

    await Promise.all( [comment.setSource(authUser), comment.setPost(post), parentAssociationProm, rootAssocationProm ]);
    notificationHelpers.notifyAndEmailAboutComment(comment, authUser, post, parentInstance);
    
    res.send({ message: 'Comment posted', data: comment })
}));

module.exports = router;
