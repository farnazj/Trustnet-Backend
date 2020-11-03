var Sequelize = require('sequelize');
var db  = require('../models');
var moment = require('moment');
const Op = Sequelize.Op;

const OLDEST_TIME_TO_KEEP = 4; //in months

async function removeOldPosts() {

    let feeds = await db.Feed.findAll({
        include: [{
            model: db.Source,
            as: 'FeedSource'
        }]
    });

    let sourcesIds = Array.from(new Set(feeds.map(el => el.FeedSource.id)));

    let postsToKeep = await db.Post.findAll({
        attributes: ['id'],
        where: {
            [Op.and]: [
                {
                    createdAt: { 
                        [Op.lte]: moment().subtract(OLDEST_TIME_TO_KEEP, 'months')
                    }
                }, {
                    SourceId: {
                        [Op.in]: sourcesIds
                    }
                }, {
                    [Op.or]:[
                        {
                            '$PostBoosts.SourceId$': {
                                [Op.ne]: Sequelize.col('Post.SourceId')
                            }
                        },
                        {
                            '$PostAssessments.SourceId$': {
                                [Op.ne]: Sequelize.col('Post.SourceId')
                            }
                        },
                        {
                            '$PostCustomTitles.id$': {
                                [Op.ne]: null
                            }
                        }
                    ]
                }
            ]
        },
        include: [{
            model: db.Boost,
            as: 'PostBoosts'
        }, {
            model: db.Assessment,
            as: 'PostAssessments'
        }, {
            model: db.CustomTitle,
            as: 'PostCustomTitles',
            required: false
        }]
    });

    await db.Post.destroy({
        where: {
            [Op.and]: [{
                createdAt: { 
                    [Op.lte]: moment().subtract(OLDEST_TIME_TO_KEEP, 'months')
                }
            }, {
                SourceId: {
                    [Op.in]: sourcesIds
                }
            }, {
                id: {
                    [Op.notIn]: postsToKeep.map(el => el.id)
                }
            }]
        }
    });

    await Promise.all([
        db.Assessment.destroy({
            where: {
                PostId: {
                    [Op.eq]: null
                }
            }
        }),
        db.Boost.destroy({
            where: {
                PostId: {
                    [Op.eq]: null
                }
            }
        })
    ]);

}

module.exports = {
  removeOldPosts
}
