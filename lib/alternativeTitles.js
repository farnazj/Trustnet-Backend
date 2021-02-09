var db = require('../models');
var redisClient = require('../lib/redisConfigs');
const { promisify } = require("util");

// const selectDBAsync = promisify(redisClient.select).bind(redisClient);
const addAsync = promisify(redisClient.sadd).bind(redisClient);
const getMembersAsync = promisify(redisClient.smembers).bind(redisClient);
const remAsync = promisify(redisClient.srem).bind(redisClient);

class AltTitlesRedisHandler {

    static async build() {
        let standaloneTitles = await db.StandaloneTitle.findAll({
            include: [{
                model: db.CustomTitle,
                as: 'StandaloneCustomTitles'
            }]
        });

        let proms = [];

        standaloneTitles.forEach(title => {
            let hashSetKey = AltTitlesRedisHandler.namespaceKeyPrefix + title.hash; 
            getMembersAsync(hashSetKey)
            .then(inSetAltTitles => {
                let associatedCustomTitles = title.StandaloneCustomTitles.map(el => el.setId);
                let customTitleSetIdsToInsert = associatedCustomTitles.filter(el => !inSetAltTitles.includes(el) );
                proms.push( customTitleSetIdsToInsert.map( customTitleId => {
                    return addAsync(hashSetKey, customTitleId);
                }))
            })
        })

        await Promise.all(proms);

        return new AltTitlesRedisHandler();
    }
    
    static get namespaceKeyPrefix()  {
        return 'Title:'
    }
    
    async addAltTitle(altTitle, standaloneTitle) {
        
        await addAsync(AltTitlesRedisHandler.namespaceKeyPrefix + standaloneTitle.hash, altTitle.setId);
    }

    async getMatchingAltTitles(standaloneTitleHash) {
        console.log(standaloneTitleHash, '***************')
        return getMembersAsync(AltTitlesRedisHandler.namespaceKeyPrefix + standaloneTitleHash);
    }

    async deleteAltTitles(altTitles, standaloneTitle) {

        let altTitlesSetIds = new Array(new Set(altTitles.map(el => el.setId)));
        let proms = [];

        proms.push(altTitlesSetIds.map(altTitleSetId => {
            return remAsync(AltTitlesRedisHandler.namespaceKeyPrefix + standaloneTitle.hash, altTitleSetId)
        }))

        return Promise.all(proms);
    }
}

module.exports = AltTitlesRedisHandler;