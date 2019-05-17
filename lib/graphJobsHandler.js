var kue = require('kue')
 , queue = kue.createQueue();
var SocialGraph = require('../lib/socialGraph');
const logger = require('../lib/logger');
var db = require('../models');
const CronJob = require('cron').CronJob;

var socialGraph;
var recalc_needed = false;

async function recalcAssessmentsForAllPosts() {
  let post_ids = await db.Post.findAll({attributes: ['id']});
  post_ids.forEach(post => socialGraph.calcTransitiveAssessments(post.id));
}

process.on('message', (msg) => {
  logger.info('Message from parent: '+ msg);
});

async function setupGraph() {
  socialGraph = await SocialGraph.build();
  recalcAssessmentsForAllPosts();
}
setupGraph().then(() => {

  const job = new CronJob('0 */10 * * * *', async function() {
   console.log('^^^^^^^time^^^^^^^^')
   console.log('^^^^^^recalc needed?', recalc_needed)
   if (recalc_needed) {

     kue.Job.rangeByType('newAssessmentPosted', 'inactive', 0 , -1, (err, jobs) => {
       job.remove(function(err){
        if (err)
          throw err;
        console.log('removed completed job #%d', job.id);
        });
     });

     await recalcAssessmentsForAllPosts();
     recalc_needed = false;
   }
  });

  job.start();

  queue.process('addNode', function(job, done){
    socialGraph.addNode(job.data.sourceId);
    console.log('in addNode');
    done();
  });

  queue.process('addEdge', function(job, done){
    socialGraph.addEdge(job.data.sourceId, job.data.targetId);
    recalc_needed = true;
    console.log('in addEdge');
    done();
  });

  queue.process('removeEdge', function(job, done){
    socialGraph.removeEdge(job.data.sourceId, job.data.targetId);
    recalc_needed = true;
    console.log('in removeEdge');
    done();
  });

  queue.process('newAssessmentPosted', async function(job, done){
    try {
      console.log('in local transitive assess for post', job.data.postId, job.data.sourceId);
      await socialGraph.calcTransitiveAssessments(job.data.postId, job.data.sourceId);
      done();
    }
    catch (err) {
      done(err);
    }
  });

})
