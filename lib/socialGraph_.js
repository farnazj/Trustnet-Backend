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
    this.buildComponents();
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

  buildComponents() {
    let components = graphlib.alg.tarjan(this.graph);
    this.componentsGraph = new graphlib.Graph({ directed: true});

    this.node2compMap = [];
    this.comp2nodeMap = [];

    components.forEach( (comp, index) => {
      let node_label = 'c' + index;
      this.componentsGraph.setNode(node_label);
      comp.forEach(node => this.node2compMap[node] = node_label);
      this.comp2nodeMap[node_label] = comp;
    });

    this.graph.edges().forEach(edge => {
      let comp_nodev = this.node2compMap[edge.v];
      let comp_nodew = this.node2compMap[edge.w];
      if (( comp_nodev != comp_nodew) && !this.componentsGraph.hasEdge(comp_nodev, comp_nodew))
        this.componentsGraph.setEdge(comp_nodev, comp_nodew);
    });

    this.sortedNodes = graphlib.alg.topsort(this.componentsGraph);
  }

  addNode(source_id) {
    this.graph.setNode(source_id);
  }

  addEdge(source_id, target_id) {
    this.graph.setEdge(source_id, target_id);
    if (this.node2compMap[source_id] != this.node2compMap[target_id])
      queue.create('recalcAssessmentsForAllPosts', {sourceId: source_id}).priority('medium').save();
  }

  removeEdge(source_id, target_id) {
    this.graph.removeEdge(source_id, target_id);
    queue.create('recalcAssessmentsForAllPosts', {sourceId: source_id}).priority('medium').save();
  }

  async recalcAssessmentsForAllPosts(source_id) {
    this.buildComponents();
    let post_ids = await db.Post.findAll({attributes: ['id']});
    post_ids.forEach(post => this.calcTransitiveAssessments(post.id));
  }

  async calcTransitiveAssessments(post_id) {

    let post_prom = db.Post.findByPk(post_id);
    let comp_assessments = {};
    logger.silly('\n\n');
    logger.silly('post id '+ post_id);

    for (const comp_node of typeHelpers.reversedIterator(this.sortedNodes)) {
      let source_ids = this.comp2nodeMap[comp_node];
      logger.silly('comp src ids '+ source_ids);
      let comp_sources = await db.Source.findAll({
        include: [{
          model: db.Assessment,
          as: 'SourceAssessments',
          attributes: ['postCredibility', 'isTransitive', 'PostId', 'id'],
          where: {
            PostId: post_id
          },
          required: false
        }],
        where: {
          id: {
            [Op.in]: source_ids
          }
        }
      });


      let orig_assessments = [];
      comp_sources.forEach(src => {
        let assessment = src.SourceAssessments[0];
        if (assessment && !assessment.isTransitive && assessment.postCredibility != constants.VALIDITY_CODES.QUESTIONED )
          orig_assessments.push(assessment.postCredibility);
      });

      let unique_trusted_assessment_val = null; //
      let value_mismatch = false;
      /*
      if all the credibility values within a strongly component agree or if none of
      the nodes within the component have posted any assessment on the post, check the
      credibility values for the other components they trust. Since this.componentsGraph
      is a DAG and it is being iterated on backwards, the credibility values for all the
      trusted components of the current component have already been calculated.
      */
      if (!orig_assessments.length || orig_assessments.every( (val, i, arr) => val === arr[0] )) {
        let out_edges = this.componentsGraph.outEdges(comp_node);
        for (let edge of out_edges) {
          if (comp_assessments[edge.w] !== null) {
            let trusted_assessment_val = comp_assessments[edge.w];
            //if credibility value of trusted component disagrees with that of the current component
            if (orig_assessments.length && trusted_assessment_val != orig_assessments[0]) {
              logger.silly('1st if '+ trusted_assessment_val + orig_assessments);
              value_mismatch = true;
              break;
            }

            if (unique_trusted_assessment_val === null)
              unique_trusted_assessment_val = trusted_assessment_val;
            //if credibility values of trusted components disagree
            else if (unique_trusted_assessment_val != trusted_assessment_val) {
              logger.silly('2nd if '+ unique_trusted_assessment_val + trusted_assessment_val);
              value_mismatch = true;
              break;
            }

          }
        }
      }

      /*
      update assessments for sources within the component that either have not
      posted an assessment on the post, or their assessment is transitive and its
      value is different from the newly computed agreed upon assessment value
      */
      logger.silly("***** values after checking prev components");
      logger.silly("assessments within the component " + orig_assessments);
      logger.silly("values within and from the other components had mismatch? " + value_mismatch);
      logger.silly("values of other components " + unique_trusted_assessment_val);

      if (!value_mismatch && orig_assessments.every( (val, i, arr) => val === arr[0] ) && (orig_assessments.length
       || unique_trusted_assessment_val !== null) ) {
        let credibility_value = unique_trusted_assessment_val !== null ? unique_trusted_assessment_val : orig_assessments[0];
          comp_assessments[comp_node] = credibility_value;
          comp_sources.forEach(async (src) => {
            let assessment = src.SourceAssessments[0];

            if (!assessment) {
              let new_assessment = await db.Assessment.create({
                postCredibility: credibility_value,
                isTransitive: true
              });
              src.addSourceAssessment(new_assessment);
              let post = await post_prom;
              post.addPostAssessment(new_assessment);
            }
            else if (assessment.isTransitive && assessment.postCredibility != credibility_value) {
              assessment.update({
                postCredibility: credibility_value
              })
            }

          });
      }
      else {
        comp_assessments[comp_node] = null;

        comp_sources.forEach(async (src) => {
          let assessment = src.SourceAssessments[0];
          if (assessment && assessment.isTransitive) {
            assessment.destroy();
          }
        })
      }

    }
  }


}

module.exports = SocialGraph;
