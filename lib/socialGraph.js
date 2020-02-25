// var Sequelize = require('sequelize');
// var db = require('../models');
// var constants = require('../lib/constants');
// var typeHelpers = require('./typeHelpers');
// var graphlib = require("@dagrejs/graphlib");
// const logger = require('../lib/logger');
// const Op = Sequelize.Op;
// var kue = require('kue')
//  , queue = kue.createQueue();
//
// class SocialGraph {
//
//   constructor(sources, recalc) {
//
//     this.graph = new graphlib.Graph({ directed: true});
//
//     for (let src of sources)
//       this.graph.setNode(src.id);
//
//     for (let src of sources) {
//       for (let target of src.Trusteds)
//         this.graph.setEdge(src.id, target.id);
//     }
//   }
//
//   static async build() {
//
//     let sources = await db.Source.findAll({
//       include: [{
//         model: db.Source,
//         as: 'Trusteds',
//         through: {
//           attributes: []
//         },
//         attributes: ['id']
//       }],
//       attributes: ['id']
//     });
//     return new SocialGraph(sources);
//   }
//
//   addNode(sourceId) {
//     this.graph.setNode(sourceId);
//   }
//
//   addEdge(sourceId, targetId) {
//     this.graph.setEdge(sourceId, targetId);
//   }
//
//   removeEdge(sourceId, targetId) {
//     this.graph.removeEdge(sourceId, targetId);
//   }
//
//   async calcTransitiveAssessments(postId, sourceId) {
//
//     let postProm = db.Post.findByPk(postId);
//
//     let allSources = await db.Source.findAll({
//       include: [{
//         model: db.Assessment,
//         as: 'SourceAssessments',
//         attributes: ['postCredibility', 'isTransitive', 'PostId', 'id'],
//         where: {
//           [Op.and]: [{
//              PostId: postId,
//            }, {
//              version: 1
//            }]
//          },
//          required: false
//        }]
//     });
//
//     let sourcesWassessmentsIds = allSources.filter(src => src.SourceAssessments.length && !src.SourceAssessments[0].isTransitive)
//       .map(src => src.id.toString());
//     let sourcesNoAssessmentIdMapping = allSources.filter(src => !src.SourceAssessments.length || src.SourceAssessments[0].isTransitive)
//       .reduce((acc, curr) => ({...acc, [curr.id]: curr}), {});
//
//     let transitiveValues = allSources.reduce((acc, curr) => ({...acc, [curr.id]: curr.SourceAssessments.length ?
//       curr.SourceAssessments[0].postCredibility: -2 }), {});
//
//     // var self = this;
//     // var marked = new PriorityQueue({ comparator: function(a, b) {
//     //   let a_succs = self.graph.successors(a);
//     //   let b_succs = self.graph.successors(b);
//     //
//     //   let a_succs_val_det = a_succs.filter(node => transitive_values[node.id] != 0 );
//     //   let b_succs_val_det = b_succs.filter(node => transitive_values[node.id] != 0 );
//     //
//     //   if (a_succs_val_det.length/a_succs.length > b_succs_val_det.length/b_succs.length)
//     //     return 1;
//     //   else
//     //    return -1;
//     // }, initialValues: all_sources.filter(src => !src.SourceAssessments.length)});
//
//     let marked;
//
//     if (sourceId) { //for local calculation of transitive assessment starting from a source id
//
//       marked = this.graph.predecessors(sourceId).filter(id => !sourcesWassessmentsIds.includes(id));
//     }
//     else { //for recalculation of all transitive assessments
//       marked = Object.values(sourcesNoAssessmentIdMapping).map(src => src.id.toString());
//
//       let notPickedIds = [...marked];
//       let initialPick = null;
//
//       while (notPickedIds.length && initialPick === null) {
//         let randomPick = notPickedIds[Math.floor(Math.random() * notPickedIds.length)];
//         let succAssessmentOwners = this.graph.successors(randomPick).filter(id => sourcesWassessmentsIds.includes(id));
//
//         if (succAssessmentOwners.length)
//           initialPick = randomPick;
//         else
//           notPickedIds.splice(notPickedIds.indexOf(randomPick), 1);
//       }
//
//       if (initialPick === null) {
//         /*
//         topology has changed and the nodes w/o assessments of their own don't have
//         paths to the assessors. If transitive assessments have been calculated for them
//         before, they need to be deleted.
//         */
//         for (const id of Object.keys(sourcesNoAssessmentIdMapping)) {
//           if (sourcesNoAssessmentIdMapping[id].SourceAssessments.length) {
//             sourcesNoAssessmentIdMapping[id].SourceAssessments[0].destroy();
//           }
//         }
//         return;
//       }
//
//       marked.splice(marked.indexOf(initialPick), 1);
//       marked.unshift(initialPick);
//     }
//
//     while (marked.length) {
//
//       let node = marked.shift();
//       let succs = this.graph.successors(node);
//       let succWcred = succs.filter(srcId => transitiveValues[srcId] != -2 && transitiveValues[srcId] != 0)
//         .map(id => transitiveValues[id]);
//
//       if (succWcred.length) {
//
//         let maxSuccCred = Math.max(...succWcred);
//         let minSuccCred = Math.min(...succWcred);
//         let transCred;
//
//         if (Math.sign(maxSuccCred) != Math.sign(minSuccCred))
//           transCred = succWcred.reduce((acc, curr) => acc + curr, 0)/succWcred.length;
//         else if (Math.sign(maxSuccCred) > 0)
//           transCred = maxSuccCred;
//         else if (Math.sign(maxSuccCred) < 0)
//           transCred = minSuccCred;
//
//         transCred *= constants.ASSESSMENT_DECAY_FACTOR;
//
//         if (Math.abs(transitiveValues[node] - transCred) > constants.ASSESSMENT_UPDATE_THRESHOLD) {
//           transitiveValues[node] = transCred;
//
//           let preds = this.graph.predecessors(node);
//           for (let pred of preds) {
//             if (!sourcesWassessmentsIds.includes(pred) && !marked.includes(pred))
//               marked.push(pred);
//           }
//         }
//       }
//       else {
//         if (sourcesNoAssessmentIdMapping[node].SourceAssessments.length)
//           sourcesNoAssessmentIdMapping[node].SourceAssessments[0].destroy();
//       }
//
//     }
//
//     let post = await postProm;
//
//     for (const [id, val] of Object.entries(transitiveValues)) {
//       if (!sourcesWassessmentsIds.includes(id) && val != -2) {
//         this.updateTransitiveAssessment(sourcesNoAssessmentIdMapping[id], post, val);
//       }
//     }
//   }
//
//   async updateTransitiveAssessment(source, post, transitiveValue) {
//
//     let assessment = source.SourceAssessments[0];
//
//     if (!assessment) {
//       if (Math.abs(transitiveValue) < constants.ASSESSMENT_ZERO_THRESHOLD) {
//           return;
//       }
//       else {
//         let newAssessment = await db.Assessment.create({
//           postCredibility: transitiveValue,
//           isTransitive: true
//         });
//         source.addSourceAssessment(newAssessment);
//         post.addPostAssessment(newAssessment);
//       }
//
//     }
//     else if (assessment.postCredibility != transitiveValue) {
//       if (Math.abs(transitiveValue) < constants.ASSESSMENT_ZERO_THRESHOLD) {
//         assessment.destroy();
//       }
//       else {
//         assessment.update({
//           postCredibility: transitiveValue
//         });
//       }
//     }
//   }
//
// }
//
// module.exports = SocialGraph;
