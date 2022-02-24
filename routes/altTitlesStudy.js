var express = require('express');
var router = express.Router();
var Sequelize = require('sequelize');
var db  = require('../models');
var routeHelpers = require('../lib/routeHelpers');
var wrapAsync = require('../lib/wrappers').wrapAsync;
var constants = require('../lib/constants');
var logger = require('../lib/logger');
const source = require('../models/source');
const Op = Sequelize.Op;

/*
articles returned on the Reheadline feed
*/
router.route('/alt-titles-feed')

.get(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {
    
    let authUser = await db.Source.findOne({
        where: {
            id: req.user.id
        },
        include: [{
            model: db.Source,
            as: 'Follows'
        }]
    });

    let followedIds = authUser.Follows.map(source => source.id);
    followedIds.push(authUser.id)

    let titleSources = [];
    if (req.headers.username) {
        titleSources = [await db.Source.findOne({
            where: {
                userName: req.headers.username
            }
        })].map(el => el.id);
    }
    else {
        titleSources = followedIds;
    }

    let queryStr = 'SELECT DISTINCT `Post`.`id`, `Post`.`publishedDate` FROM `Posts` AS `Post` \
    LEFT OUTER JOIN `StandaloneTitles` AS `PostStandAloneTitles` ON `Post`.`id` = `PostStandAloneTitles`.`PostId` \
    LEFT OUTER JOIN (`OriginalCustomTitles` AS `StandaloneTitles->OriginalCustomTitles` \
    INNER JOIN `CustomTitles` AS `StandaloneTitles->StandaloneCustomTitles` ON \
    `StandaloneTitles->StandaloneCustomTitles`.`id` = `StandaloneTitles->OriginalCustomTitles`.`CustomTitleId`) \
    ON `PostStandAloneTitles`.`id` = `StandaloneTitles->OriginalCustomTitles`.`standaloneTitleId` \
    LEFT OUTER JOIN ( `TitleEndorsements` AS `StandaloneTitles->StandaloneCustomTitles->Endorsers->TitleEndorsements` \
    INNER JOIN `Sources` AS `StandaloneTitles->StandaloneCustomTitles->Endorsers` ON \
    `StandaloneTitles->StandaloneCustomTitles->Endorsers`.`id` = `StandaloneTitles->StandaloneCustomTitles->Endorsers->TitleEndorsements`.`SourceId`) \
    ON `StandaloneTitles->StandaloneCustomTitles`.`id` = `StandaloneTitles->StandaloneCustomTitles->Endorsers->TitleEndorsements`.`CustomTitleId` AND \
    `StandaloneTitles->StandaloneCustomTitles->Endorsers`.`id` IN :endorsers \
    WHERE `StandaloneTitles->StandaloneCustomTitles`.`SourceId` IN :title_sources\
    ORDER BY `Post`.`publishedDate` DESC \
    LIMIT :offset, :limit;';


    let replacements = {
        endorsers: [followedIds],
        title_sources: [titleSources],
        offset: parseInt(req.query.offset),
        limit: parseInt(req.query.limit)
    }

    let postObjs = await db.sequelize.query(queryStr,
        { replacements: replacements, type: Sequelize.QueryTypes.SELECT });
    
    let postIds = postObjs.map(el => el.id);

    let posts = await db.Post.findAll({
        where: {
            id: {
                [Op.in]: postIds
            }
        },
        include: [{
            model: db.StandaloneTitle,
            as: 'PostStandAloneTitles',
            include: [{
                model: db.CustomTitle,
                as: 'StandaloneCustomTitles',
                include: [{
                    model: db.Source,
                    as: 'Endorsers',
                    where: {
                        id: {
                            [Op.in]: followedIds
                        }
                    },
                    required: false
                }]
            }]
        }],
        order: [
            // [ db.StandaloneTitle, 'StandaloneCustomTitles', 'updatedAt', 'DESC'],
            [ 'publishedDate', 'DESC']
        ]
    });

    res.send(posts);
}));


router.route('/finish-alt-title-signup/:token')

.post(wrapAsync(async function(req, res) {

    let verificationToken = await db.Token.findOne({
        where: {
          tokenStr: req.params.token,
          tokenType: constants.TOKEN_TYPES.ACCOUNT_VERIFICATION,
          expires: { [Op.gt]: Date.now() }
        },
        include: [{
          model: db.Source
        }]
      });
    
    let authUser = verificationToken.Source;
    let authUserPreferences = await db.Preferences.findOrCreate({
        where: {
            sourceId: authUser.id
        }
    });

    let oldPreferences;

    if (authUserPreferences[0].preferencesBlob == undefined)
        oldPreferences = { "blackListedWebsites": constants.DEFAULT_HEADLINE_BLACKLISTS };
    else
        oldPreferences = JSON.parse(authUserPreferences[0].preferencesBlob);

    let updatedPreferences = oldPreferences;
    updatedPreferences.altExperiment = true;
    authUserPreferences[0].preferencesBlob = JSON.stringify(updatedPreferences);

    let authUserPreferencesProms = [];
    authUserPreferencesProms.push(authUserPreferences[0].save());
    if (authUserPreferences[1])
        authUserPreferencesProms.push(authUserPreferences[0].setSource(authUser));

    await Promise.all(authUserPreferencesProms);

    let otherUsers = await db.Source.findAll({
        where: {
            [Op.and]: [{
                systemMade: false
            }, {
                '$Source.id$': {
                    [Op.ne]: authUser.id
                }
            }]
        },
        include: [{
            model: db.Preferences,
            required: true
        }]
    })

    let proms = [];

    otherUsers.forEach(user => {
        if (user.Preference && user.Preference.preferencesBlob != undefined) {
            let preferencesBlob = JSON.parse(user.Preference.preferencesBlob);
            if ('altExperiment' in preferencesBlob) {
                proms.push(...[
                    user.addFollow(authUser),
                    authUser.addFollow(user)
                ]);
            }
        }
        // proms.push(authUser.addFollow(user));
    })

    await Promise.all([...proms, verificationToken.destroy()]);
  
    res.send({ message: 'Finished alt title signup' })
}));

/*
Route for signing up Reheadline study users, where each user will automatically
follow other users in the study upon signup
*/
router.route('/study-users')

.get(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

    let paginationReq = routeHelpers.getLimitOffset(req);
    let searchTerm = req.headers.searchterm ? req.headers.searchterm : '';

    let whereClause = {
        [Op.and]: [{
            systemMade: false
        }, {
            '$Source.id$': {
                [Op.ne]: req.user.id
            }
        }, {
            isVerified: true
        }]
    }

    if (searchTerm.length) {
        let searchClause = {
            [Op.or]: [ 
                db.sequelize.where(db.sequelize.fn('concat', db.sequelize.col('firstName'), ' ', db.sequelize.col('lastName')), {
                    [Op.like]: '%' + searchTerm + '%'
                }),
                {
                userName: { [Op.like]: '%' + searchTerm + '%' }
                }
            ]
        }

        whereClause = {
            [Op.and]: [
                whereClause,
                searchClause
            ]
        }
    }
    
    let sources = await db.Source.findAll({
        where: whereClause,
        include: [{
            model: db.Preferences,
            required: true
        }],
        ...paginationReq
    });

    let otherUserInStudy = [];
    sources.forEach(user => {
        if (user.Preference && user.Preference.preferencesBlob != undefined) {
            let preferencesBlob = JSON.parse(user.Preference.preferencesBlob);
            if ('altExperiment' in preferencesBlob) {
                otherUserInStudy.push(user);
            }
        }
    })

    res.send(otherUserInStudy);
}));



router.route('/headline-study-log')

.post(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

    logger.study(`${req.user.id}, ${req.body.type}, ${JSON.stringify(req.body.data)}, ${req.body.client}`);
    res.send({ message: 'Log successful' });
}));

module.exports = router;
