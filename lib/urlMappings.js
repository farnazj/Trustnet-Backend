var db = require('../models');
var redisClient = require('../lib/redisConfigs');
var Sequelize = require('sequelize');
const Op = Sequelize.Op;
var moment = require('moment');
const { promisify } = require("util");

const msetAsync = promisify(redisClient.mset).bind(redisClient);
const mgetAsync = promisify(redisClient.mget).bind(redisClient);
const delAsync = promisify(redisClient.del).bind(redisClient);

class URLMappingsHandler {

    static async build() {
        let URLMappings = await db.URLRedirection.findAll();

        let proms = [];
        let mappingIdsToDelete = [];

        URLMappings.forEach(mapping => {
            let key = URLMappingsHandler.namespaceKeyPrefix + mapping.originURL; 
           
            if (moment.utc().diff(mapping.lastAccessTime , 'months') >= 3) {
                mappingIdsToDelete.push(mapping.id)
            }
            else {
                proms.push(msetAsync(key, mapping.targetURL));
            }
            
        })


        if (mappingIdsToDelete.length) {
           proms.push( db.URLRedirection.destroy({
            where: {
                id: {
                    [Op.in]: mappingIdsToDelete
                }
            }
            }))
        }
        
        try {
            await Promise.allSettled(proms);
        }
        catch(err) {
            logger.err(`error in initializing URLMappingHandler: ${err}`)
        }
       

        return new URLMappingsHandler();
    }
    
    static get namespaceKeyPrefix()  {
        return 'URL-Mapping:'
    }
    
    async addMappings(mappingInstances) {

        // console.log(mappingInstances, 'in adding mappings in redis')

        let mappingArr = [];
        mappingInstances.forEach(el => {
            mappingArr.push(URLMappingsHandler.namespaceKeyPrefix + el.originURL);
            mappingArr.push(el.targetURL);
        });

        await msetAsync(mappingArr);
    }

    async getURLMapping(originURLs) {
        let originArr = originURLs.map(el =>
            URLMappingsHandler.namespaceKeyPrefix + el
        )

        if (originArr.length) {
            return mgetAsync(originArr);
        }
        else
            return new Promise((resolve)=> resolve([]));
    }

    async deleteMappings(mappingsToDelete) {

        let keysToDelete = mappingsToDelete.map(el => 
            URLMappingsHandler.namespaceKeyPrefix + el.originURL);

        return delAsync(keysToDelete);
    }
}

module.exports = URLMappingsHandler;