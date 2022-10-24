// var kue = require('kue')
//  , queue = kue.createQueue();
// var SocialGraph = require('../lib/socialGraph');
// const logger = require('../lib/logger');
// var db = require('../models');
// const CronJob = require('cron').CronJob;
//
// var socialGraph;
// var recalcNeeded = false;
//
// async function recalcAssessmentsForAllPosts() {
//
//   let postIds = await db.Post.findAll({attributes: ['id']});
//   let recalcPromises = [];
//   postIds.forEach(post => recalcPromises.push(socialGraph.calcTransitiveAssessments(post.id)));
//   await Promise.all(recalcPromises);
// }
//
// process.on('message', (msg) => {
//   logger.info('Message from parent: '+ msg);
// });
//
// async function setupGraph() {
//
//   socialGraph = await SocialGraph.build();
//   recalcAssessmentsForAllPosts();
// }
//
// setupGraph().then(() => {
//
//   const job = new CronJob('0 */10 * * * *', async function() {
//    logger.info('^^^^^^recalc needed? '+ recalcNeeded)
//    if (recalcNeeded) {
//
//      kue.Job.rangeByType('newAssessmentPosted', 'inactive', 0 , -1, 'asc', (err, jobs) => {
//        jobs.forEach( (job) => {
//          job.remove(function(err) {
//           if (err) {
//             throw err;
//           }
//
//           logger.info('removed completed job #%d', job.id);
//           });
//        })
//      });
//      recalcNeeded = false;
//      await recalcAssessmentsForAllPosts();
//    }
//   });
//
//   job.start();
//
//   queue.process('addNode', function(job, done) {
//     socialGraph.addNode(job.data.sourceId);
//     logger.silly('in addNode');
//     done();
//   });
//
//   queue.process('addEdge', function(job, done) {
//     socialGraph.addEdge(job.data.sourceId, job.data.targetId);
//     recalcNeeded = true;
//     logger.silly('in addEdge');
//     done();
//   });
//
//   queue.process('removeEdge', function(job, done) {
//     socialGraph.removeEdge(job.data.sourceId, job.data.targetId);
//     recalcNeeded = true;
//     logger.silly('in removeEdge');
//     done();
//   });
//
//   queue.process('newAssessmentPosted', async function(job, done) {
//     try {
//       logger.silly('in local transitive assess for post', job.data.postId, job.data.sourceId);
//       await socialGraph.calcTransitiveAssessments(job.data.postId, job.data.sourceId);
//       done();
//     }
//     catch (err) {
//       done(err);
//     }
//   });
//
// })
