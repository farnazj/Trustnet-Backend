'use strict';
var db = require('../../models');
const logger = require('../../lib/logger');
var metaScraperHelpers = require('../../lib/metaScraperHelpers');

module.exports = {
  up: (queryInterface, Sequelize) => {

    return new Promise(async (resolve, reject) => {

      try {
        await queryInterface.createTable(
          'Tags', {
            id: {
              type: Sequelize.INTEGER,
              primaryKey: true,
              autoIncrement: true
            },
            text: {
              type: Sequelize.TEXT('medium')
            },
            createdAt: {
              type: Sequelize.DATE
            },
            updatedAt: {
              type: Sequelize.DATE
            }
          },
          {
            charset: 'utf8mb4',
          }
        );

        await queryInterface.createTable(
          'PostTags', {
            createdAt: {
              type: Sequelize.DATE
            },
            updatedAt: {
              type: Sequelize.DATE
            },
            PostId: {
               type: Sequelize.INTEGER,
               references: {
                 model: 'Posts',
                 key: 'id'
               },
               onUpdate: 'cascade',
               onDelete: 'cascade'
            },
            TagId: {
               type: Sequelize.INTEGER,
               references: {
                 model: 'Tags',
                 key: 'id'
               },
               onUpdate: 'cascade',
               onDelete: 'cascade'
            }
          }
        );

        await queryInterface.addColumn(
          'Posts',
          'opinion',
          Sequelize.BOOLEAN
        );
        

        const posts = await db.Post.findAll();

        let offset = 0;
        let limit = 3000;

        while(offset < posts.length) {

          let postProms = [];

          posts.slice(offset, offset + limit).forEach(post => {
            postProms.push(
             metaScraperHelpers.getArticleMetaData(post.url)
            .then( (articleMeta) => {
              return post.update({
                opinion: articleMeta.opinion
              })
              .then( () => {

                let tagProms = [];
                if (articleMeta.tags !== null) {
                  articleMeta.tags.forEach(tag => {

                    tagProms.push(
                      db.Tag.findOrCreate({
                        where: {
                          text: tag
                        }
                      })
                      .spread( (dbTag, created) => {
                        return post.addTags(dbTag);
                      })
                    )
                  })
                }

                return Promise.all(tagProms);
              })

            })
          )

          })

          await Promise.all([].concat.apply([], postProms));
          offset += limit;
        }

        resolve();
      }
      catch (err) {
        console.log(err)
        logger.error(err);
        reject();
      }
    })
  },

  down: (queryInterface, Sequelize) => {

    return new Promise(async (resolve, reject) => {

      try {
        await Promise.all([queryInterface.dropTable(
          'PostTags'
        ), queryInterface.dropTable(
          'Tags'
        ), queryInterface.removeColumn(
          'Posts',
          'opinion',
        )]);

        resolve();
      }
      catch (err) {
        logger.error(err);
        reject();
      }
    })
  }
};
