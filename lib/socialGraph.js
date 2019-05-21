var Sequelize = require('sequelize');
var db = require('../models');
var constants = require('../lib/constants');
var typeHelpers = require('./typeHelpers');
var graphlib = require("@dagrejs/graphlib");
const logger = require('../lib/logger');
const Op = Sequelize.Op;
var kue = require('kue')
 , queue = kue.createQueue();

class SocialGraph {

  constructor(sources, recalc) {

    this.graph = new graphlib.Graph({ directed: true});

    for (let src of sources)
      this.graph.setNode(src.id);

    for (let src of sources) {
      for (let target of src.Trusteds)
        this.graph.setEdge(src.id, target.id);
    }
  }

  static async build() {

    let sources = await db.Source.findAll({
      include: [{
        model: db.Source,
        as: 'Trusteds',
        through: {
          attributes: []
        },
        attributes: ['id']
      }],
      attributes: ['id']
    });
    return new SocialGraph(sources);
  }

  addNode(source_id) {
    this.graph.setNode(source_id);
  }

  addEdge(source_id, target_id) {
    this.graph.setEdge(source_id, target_id);
  }

  removeEdge(source_id, target_id) {
    this.graph.removeEdge(source_id, target_id);
  }

  async calcTransitiveAssessments(post_id, source_id) {
    let post_prom = db.Post.findByPk(post_id);

    let all_sources = await db.Source.findAll({
      include: [{
        model: db.Assessment,
        as: 'SourceAssessments',
        attributes: ['postCredibility', 'isTransitive', 'PostId', 'id'],
        where: {
          [Op.and]: [{
             PostId: post_id,
           }, {
             version: 1
           }]
         },
         required: false
       }]
    });

    let sources_w_assessment_ids = all_sources.filter(src => src.SourceAssessments.length && !src.SourceAssessments[0].isTransitive)
      .map(src => src.id.toString());
    let sources_no_assessment_id_mapping = all_sources.filter(src => !src.SourceAssessments.length || src.SourceAssessments[0].isTransitive)
      .reduce((acc, curr) => ({...acc, [curr.id]: curr}), {});

    let transitive_values = all_sources.reduce((acc, curr) => ({...acc, [curr.id]: curr.SourceAssessments.length ?
      curr.SourceAssessments[0].postCredibility: -2 }), {});

    // var self = this;
    // var marked = new PriorityQueue({ comparator: function(a, b) {
    //   let a_succs = self.graph.successors(a);
    //   let b_succs = self.graph.successors(b);
    //
    //   let a_succs_val_det = a_succs.filter(node => transitive_values[node.id] != 0 );
    //   let b_succs_val_det = b_succs.filter(node => transitive_values[node.id] != 0 );
    //
    //   if (a_succs_val_det.length/a_succs.length > b_succs_val_det.length/b_succs.length)
    //     return 1;
    //   else
    //    return -1;
    // }, initialValues: all_sources.filter(src => !src.SourceAssessments.length)});

    let marked;

    if (source_id) { //for local calculation of transitive assessment starting from a source id

      marked = this.graph.predecessors(source_id).filter(id => !sources_w_assessment_ids.includes(id));
    }
    else { //for recalculation of all transitive assessments
      marked = Object.values(sources_no_assessment_id_mapping).map(src => src.id.toString());

      let not_picked_ids = [...marked];
      let initialPick = null;

      while (not_picked_ids.length && initialPick === null) {
        let random_pick = not_picked_ids[Math.floor(Math.random() * not_picked_ids.length)];
        let succ_assessment_owners = this.graph.successors(random_pick).filter(id => sources_w_assessment_ids.includes(id) );

        if (succ_assessment_owners.length)
          initialPick = random_pick;
        else
          not_picked_ids.splice(not_picked_ids.indexOf(random_pick), 1);
      }

      if (initialPick === null) {
        /*
        topology has changed and the nodes w/o assessments of their own don't have
        paths to the assessors. If transitive assessments have been calculated for them
        before, they need to be deleted.
        */
        for (const id of Object.keys(sources_no_assessment_id_mapping)) {
          if (sources_no_assessment_id_mapping[id].SourceAssessments.length) {
            sources_no_assessment_id_mapping[id].SourceAssessments[0].destroy();
          }
        }
        return;
      }

      marked.splice(marked.indexOf(initialPick), 1);
      marked.unshift(initialPick);
    }


    while (marked.length) {

      let node = marked.shift();
      let succs = this.graph.successors(node);
      let succs_w_cred = succs.filter(src_id => transitive_values[src_id] != -2 && transitive_values[src_id] != 0)
        .map(id => transitive_values[id]);

      if (succs_w_cred.length) {

        let max_succ_cred = Math.max(...succs_w_cred);
        let min_succ_cred = Math.min(...succs_w_cred);
        let trans_cred;

        if (Math.sign(max_succ_cred) != Math.sign(min_succ_cred))
          trans_cred = succs_w_cred.reduce((acc, curr) => acc + curr, 0)/succs_w_cred.length;
        else if (Math.sign(max_succ_cred) > 0)
          trans_cred = max_succ_cred;
        else if (Math.sign(max_succ_cred) < 0)
          trans_cred = min_succ_cred

        trans_cred *= constants.ASSESSMENT_DECAY_FACTOR;

        if (Math.abs(transitive_values[node] - trans_cred) > constants.ASSESSMENT_UPDATE_THRESHOLD) {
          transitive_values[node] = trans_cred;

          let preds = this.graph.predecessors(node);
          for (let pred of preds) {
            if (!sources_w_assessment_ids.includes(pred) && !marked.includes(pred))
              marked.push(pred);
          }
        }
      }
      else {
        if (sources_no_assessment_id_mapping[node].SourceAssessments.length)
          sources_no_assessment_id_mapping[node].SourceAssessments[0].destroy();
      }

    }

    let post = await post_prom;

    for (const [id, val] of Object.entries(transitive_values)) {
      if (!sources_w_assessment_ids.includes(id) && val != -2) {
        this.updateTransitiveAssessment(sources_no_assessment_id_mapping[id], post, val);
      }
    }

  }

  async updateTransitiveAssessment(source, post, transitive_value) {

    let assessment = source.SourceAssessments[0];

    if (!assessment) {
      if (Math.abs(transitive_value) < constants.ASSESSMENT_ZERO_THRESHOLD) {
          return;
      }
      else {
        let new_assessment = await db.Assessment.create({
          postCredibility: transitive_value,
          isTransitive: true
        });
        source.addSourceAssessment(new_assessment);
        post.addPostAssessment(new_assessment);
      }

    }
    else if (assessment.postCredibility != transitive_value) {
      if (Math.abs(transitive_value) < constants.ASSESSMENT_ZERO_THRESHOLD) {
        assessment.destroy();
      }
      else {
        assessment.update({
          postCredibility: transitive_value
        })
      }
    }
  }

}

module.exports = SocialGraph;
