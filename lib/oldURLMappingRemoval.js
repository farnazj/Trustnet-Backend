var Sequelize = require('sequelize');
var db  = require('../models');
var moment = require('moment');
const Op = Sequelize.Op;

const OLDEST_TIME_TO_KEEP = 2; //in months

async function removeOldURLMappings() {

    let mappingsToDestroy = await db.URLRedirection.findAll({
        where: {
            lastAccessTime: {
                [Op.lte]: moment().subtract(OLDEST_TIME_TO_KEEP, 'months')
            }
        }
    });
    
    let idsToDestroy = mappingsToDestroy.map(el => el.id);
 
    if (mappingsToDestroy.length) {
        return urlMappingsRedisHandler.deleteMappings(mappingsToDestroy)
        .then(() => {
            return db.URLRedirection.destroy({
                where: {
                    id: {
                        [Op.in]: idsToDestroy
                    }
                }
            })
        })
    }
    else {
        return new Promise((resolve) => { resolve(); })
    }
    
}

module.exports = {
    removeOldURLMappings
}
