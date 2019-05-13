var kue = require('kue')
 , queue = kue.createQueue();
var Sequelize = require('sequelize');
const Op = Sequelize.Op;
var SocialGraph = require('../lib/socialGraph');
const logger = require('../lib/logger');
var db = require('../models');
const CronJob = require('cron').CronJob;

var socialGraph;
var post_ids_to_process = [];
var recalc_needed = false;

async function recalcAssessmentsForAllPosts() {
  socialGraph.calculateDistances();
  let post_ids = await db.Post.findAll({attributes: ['id']});
  post_ids.forEach(post => socialGraph.calcTransitiveAssessments(post.id));
}

async function setupGraph() {
  socialGraph = await SocialGraph.build();
  recalcAssessmentsForAllPosts();
}

process.on('message', (msg) => {
  logger.info('***********Message from parent:************ '+ msg);
});

setupGraph().then(() => {

  const job = new CronJob('0 */10 * * * *', async function() {
    console.log('^^^^^^^time^^^^^^^^')
    if (recalc_needed) {
      socialGraph.calculateDistances();
      await recalcAssessmentsForAllPosts();
      recalc_needed = false;
      post_ids_to_process = [];
    }
    else {
      if (post_ids_to_process.length) {
        let post_ids = await db.Post.findAll({
          attributes: ['id'],
          where: {
            id: {
              [Op.in] : post_ids_to_process
            }
          }
        });
        post_ids.forEach(post => socialGraph.calcTransitiveAssessments(post.id));
        post_ids_to_process = [];
      }
    }

  });

  job.start();

  queue.process('addNode', function(job, done){
    socialGraph.addNode(job.data.sourceId);
    logger.silly('**************in addNode');
    done();
  });

  queue.process('addEdge', function(job, done){
    socialGraph.addEdge(job.data.sourceId, job.data.targetId);
    recalc_needed = true;
    logger.silly('**************in addEdge');
    done();
  });

  queue.process('removeEdge', function(job, done){
    socialGraph.removeEdge(job.data.sourceId, job.data.targetId);
    recalc_needed = true;
    logger.silly('**************in removeEdge');
    done();
  });

  queue.process('newAssessmentPosted', function(job, done){
    post_ids_to_process.push(job.data.postId)
    logger.silly('**************new assessment posted for ' + job.data.postId);
    done();
  });

})
