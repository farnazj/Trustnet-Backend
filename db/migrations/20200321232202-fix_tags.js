'use strict';
var Sequelize = require('sequelize');
var db = require('../../models');
const logger = require('../../lib/logger');
const Op = Sequelize.Op;

module.exports = {
  up: (queryInterface, Sequelize) => {

    return new Promise(async (resolve, reject) => {

      try {

        const tags = await db.Tag.findAll({
          where: {
            text: {
              [Op.regexp]: '[a-zA-Z0-9()]*,[A-Z]'
            }
          },
          include: [{
            model: db.Post,
            through: {
              attributes: []
            }
          }]
        });

        let tagProms = [];

        tags.forEach(compoundTag => {
          let splitTags = compoundTag.text.split(',');
          let posts = compoundTag.Posts;

          logger.info(compoundTag.id + compoundTag.text + posts.map(el => el.id));

          splitTags.forEach(splitTag => {

            tagProms.push(
                db.Tag.findOrCreate({
                  where: {
                    text: splitTag
                  }
                })
                .spread( (dbTag, created) => {
                    return Promise.all(
                      posts.map(post => {
                        return post.addTag(dbTag);
                      })
                    )
                })
              )
          })
        })

        await Promise.all([].concat.apply([], tagProms));
        await queryInterface.bulkDelete('Tags', {
          id: {
            [Op.in]: tags.map(el => el.id)
          }
        });

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
        resolve();
      }
      catch (err) {
        logger.error(err);
        reject();
      }
    })
  }
};
