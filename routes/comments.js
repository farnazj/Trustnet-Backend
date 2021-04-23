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

module.exports = router;
