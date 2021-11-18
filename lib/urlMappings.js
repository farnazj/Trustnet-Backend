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

        await Promise.all([...proms,
            db.URLRedirection.destroy({
                where: {
                    id: {
                        [Op.in]: mappingIdsToDelete
                    }
                }
            })
         ]);

        return new URLMappingsHandler();
    }
    
    static get namespaceKeyPrefix()  {
        return 'URL-Mapping:'
    }
    
    async addMappings(mappingInstances) {

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

        if (originArr.length)
            return mgetAsync(originArr);
        else
            return new Promise((resolve)=> resolve([]));
    }

    async deleteMappings(deleteMappings) {

        let keysToDelete = deleteMappings.map(el => 
            URLMappingsHandler.namespaceKeyPrefix + el.originURL);

        return delAsync(keysToDelete);
    }
}

module.exports = URLMappingsHandler;