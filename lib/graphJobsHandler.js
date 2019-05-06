// var kue = require('kue')
//  , queue = kue.createQueue();
// var SocialGraph = require('../lib/socialGraph');
// const logger = require('../lib/logger');
// var db = require('../models');
//
// var socialGraph;
//
// async function setupGraph() {
//   socialGraph = await SocialGraph.build();
//   let post_ids = await db.Post.findAll({attributes: ['id']});
//   post_ids.forEach(post => socialGraph.calcTransitiveAssessments(post.id));
// }
// setupGraph().then(() => {
//   process.on('message', (msg) => {
//     logger.info('Message from parent: '+ msg);
//   });
//
//   queue.process('addNode', function(job, done){
//     socialGraph.addNode(job.data.sourceId);
//     logger.silly('in addNode');
//     done();
//   });
//
//   queue.process('recalcAssessmentsForAllPosts', function(job, done){
//     socialGraph.recalcAssessmentsForAllPosts(job.data.sourceId);
//     logger.silly('in recalc');
//     done();
//   });
//
//   queue.process('addEdge', function(job, done){
//     socialGraph.addEdge(job.data.sourceId, job.data.targetId);
//     logger.silly('in addEdge');
//     done();
//   });
//
//   queue.process('removeEdge', function(job, done){
//     socialGraph.removeEdge(job.data.sourceId, job.data.targetId);
//     logger.silly('in removeEdge');
//     done();
//   });
//
//   queue.process('calcTransitiveAssessments', function(job, done){
//     socialGraph.calcTransitiveAssessments(job.data.postId);
//     logger.silly('in transitive assess');
//     done();
//   });
//
// })
