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
    this.calculateDistances();
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

  calculateDistances() {
    var self = this;
    // this.distances = graphlib.alg.dijkstraAll(this.graph, function weight(e) {
    //   console.log("yarom bia", self.graph)
    //    return self.graph.edge(e);
    //  });

    this.distances = graphlib.alg.dijkstraAll(this.graph);
    console.log('distances', this.distances)

    let max_distance = -1;

    for (let source in this.distances) {
      let max_dist_source = Object.values(this.distances[source]).reduce((acc, curr) =>
        curr.distance != Number.POSITIVE_INFINITY ? (acc < curr.distance ? curr.distance : acc) : acc, -1)
      if (max_dist_source > max_distance)
        max_distance = max_dist_source
    }

    this.infinity = max_distance + 1;
  }

  async calcTransitiveAssessments(post_id) {
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

    let source_assessment_mapping = all_sources.filter(src => src.SourceAssessments.length && !src.SourceAssessments[0].isTransitive)
      .reduce((acc, curr) => ({ ...acc, [curr.id]: curr.SourceAssessments[0].postCredibility }), {})

    let sources_no_assessment_id_mapping = all_sources.filter(src => !src.SourceAssessments.length || src.SourceAssessments[0].isTransitive)
      .reduce((acc, curr) => ({...acc, [curr.id]: curr}), {});

    let assessment_dists_per_source = {};
    let max_distance = -1;

    for (let src_id in sources_no_assessment_id_mapping) {
      for (let assessor_id in source_assessment_mapping) {

        if (this.distances[src_id][assessor_id].distance != Number.POSITIVE_INFINITY) {
          if (!(src_id in assessment_dists_per_source))
            assessment_dists_per_source[src_id] = [];

          assessment_dists_per_source[src_id].push({'distance': this.distances[src_id][assessor_id].distance,
          'credibility': source_assessment_mapping[assessor_id]});
        }
      }
    }
    console.log("for post", post_id)
    console.log('assessment_dists_per_source', assessment_dists_per_source)
    let post = await post_prom;

    for (let src_id in assessment_dists_per_source) {
      let transitive_value = assessment_dists_per_source[src_id].reduce((acc, curr) => acc + (this.infinity
        - curr.distance) * curr.credibility, 0)/(assessment_dists_per_source[src_id].reduce((acc, curr) =>
        acc + (this.infinity - curr.distance) , 0));

      console.log('transitive value is ', transitive_value)
      console.log("\n\n")
      //this.updateTransitiveAssessment(sources_no_assessment_id_mapping[src_id], post, transitive_value);
    }

  }

  async updateTransitiveAssessment(source, post, transitive_value) {

    let transitive_assessment_value;
    if (transitive_value > constants.TRANSITIVE_POS_THRESHOLD)
      transitive_assessment_value = constants.VALIDITY_CODES.CONFIRMED;
    else if (transitive_value < constants.TRANSITIVE_NEG_THRESHOLD)
      transitive_assessment_value = constants.VALIDITY_CODES.REFUTED;
    else
      return;

    let assessment = source.SourceAssessments[0];

    if (!assessment) {
      let new_assessment = await db.Assessment.create({
        postCredibility: transitive_assessment_value,
        isTransitive: true
      });
      source.addSourceAssessment(new_assessment);
      post.addPostAssessment(new_assessment);
    }
    else if (assessment.postCredibility != transitive_assessment_value) {
      assessment.update({
        postCredibility: transitive_assessment_value
      })
    }

  }

}

module.exports = SocialGraph;
