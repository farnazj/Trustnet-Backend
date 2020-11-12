'use strict';
var Sequelize = require('sequelize');
var db = require('../../models');
const logger = require('../../lib/logger');
var constants = require('../../lib/constants');
const Op = Sequelize.Op;

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return new Promise(async (resolve, reject) => {

      try {

        let postsToExclude = await db.Post.findAll({
          where: {
            '$PostAssessments.SourceId$': {
              [Op.eq]: Sequelize.col('Post.SourceId')
            }
          },
          include: [{
            model: db.Assessment,
            as: 'PostAssessments'
          }]
          });

        let posts = await db.Post.findAll({
          where: {
            id: {
              [Op.notIn]: postsToExclude.map(el => el.id)
            }
          }
        })

        console.log(posts.map(el => el.id))

        let proms = [];

        posts.forEach(post => {
          proms.push(Promise.all([
            db.Assessment.create({
              postCredibility: constants.VALIDITY_CODES.CONFIRMED,
              isTransitive: false,
              sourceIsAnonymous: false,
              createdAt: post.createdAt,
              updatedAt: post.updatedAt
            }),
            db.Source.findByPk(post.SourceId)
          ]).then( ([assessment, source]) => {
            return Promise.all([
              post.addPostAssessment(assessment),
              source.addSourceAssessment(assessment)
            ])
          }))

        })

        await Promise.all(proms);
        resolve();

      }
      catch (err) {
        console.log(err)
        logger.error(err);
        reject();
      }
    })
  },

  down: async (queryInterface, Sequelize) => {
    return new Promise(async (resolve, reject) => {

      try {
        resolve();
      }
      catch (err) {
        console.log(err)
        logger.error(err);
        reject();
      }
    })
  }
};
