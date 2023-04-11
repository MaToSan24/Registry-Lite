/*!
governify-registry 3.0.1, built on: 2018-04-18
Copyright (C) 2018 ISA group
http://www.isa.us.es/
https://github.com/isa-group/governify-registry

governify-registry is an Open-source software available under the
GNU General Public License (GPL) version 2 (GPL v2) for non-profit
applications; for commercial licensing terms, please see README.md
for any inquiry.

This program is free software; you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation; either version 2 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

'use strict';

const governify = require('governify-commons');
const logger = governify.getLogger().tag('agreement-state-manager');
const db = require('../../database');
const stateManager = require('../../stateManager/v6/state-manager.js');
const calculators = require('../../../../stateManager/v6/calculators.js');

const Promise = require('bluebird');
const request = require('request');
const JSONStream = require('JSONStream');

/**
 * Agreement state module.
 * @module agreementsState
 * @see module:states
 * @requires config
 * @requires stateManager
 * @requires calculators
 * @requires bluebird
 * @requires request
 * */
module.exports = {
  // Agreement
  getAgreementStatesById,
  deleteAllAgreementsStates,
  deleteAgreementStatesById,
  recalculateAgreementStateById,
  // Metrics
  getAllMetricsStates,
  getMetricStatesById,
  // States
  getAgreementsStatesFiltered
};

/**
 * Get an agreement state by agreement ID.
 * @param {Object} args {agreement: String}
 * @param {Object} res response
 * @param {Object} next next function
 * @alias module:agreements.getAgreementStatesById
 * */
function getAgreementStatesById (args, res) {
  logger.info('New request to GET agreements (states/agreements/agreements.js)');
  const agreementId = args.agreement.value;

  stateManager({
    id: agreementId
  }).then(function (manager) {
    manager.get(agreementId).then(function (agreement) {
      res.json(agreement);
    }, function (err) {
      logger.error(err.message.toString());
      res.status(err.code).json(err);
    });
  }, function (err) {
    logger.error(err.message.toString());
    res.status(err.code).json(err);
  });
}

/**
 * Delete an agreement state by agreement ID.
 * @param {Object} args {agreement: String, from: String, to: String}
 * @param {Object} res response
 * @param {Object} next next function
 * @alias module:agreements.deleteAgreementStatesById
 * */
function deleteAgreementStatesById (args, res) {
  const agreementId = args.agreement.value;
  logger.info('New request to DELETE agreement state for agreement ' + agreementId);
  if (agreementId) {
    const StateModel = db.models.StateModel;
    StateModel.remove({
      agreementId: agreementId
    }, function (err) {
      if (!err) {
        res.sendStatus(200);
        logger.info('Deleted state for agreement ' + agreementId);
      } else {
        res.sendStatus(404);
        logger.warn("Can't delete state for agreement " + agreementId + ' :' + err);
      }
    });
  } else {
    res.sendStatus(400);
    logger.warn("Can't delete state for agreement " + agreementId);
  }
}

/**
 * Delete all agreement states
 * @param {Object} args {agreement: String}
 * @param {Object} res response
 * @param {Object} next next function
 * @alias module:agreements.deleteAllAgreementsStates
 * */
function deleteAllAgreementsStates (args, res) {
  logger.info('New request to DELETE all agreement states');
  const StateModel = db.models.StateModel;
  StateModel.remove(function (err) {
    if (!err) {
      res.sendStatus(200);
      logger.info('Deleted state for all agreements');
    } else {
      res.sendStatus(404);
      logger.warn("Can't delete state for all agreements: " + err);
    }
  });
}

/**
 * GET all the states of all the metrics
 * @param {Object} req request
 * @param {Object} res response
 * @param {Object} next next function
 * @alias module:metrics.metricsPOST
 * */
function getAllMetricsStates (req, res) {
  const args = req.swagger.params;
  const agreementId = args.agreement.value;

  logger.info('New request to GET metrics of agreement: ' + agreementId);

  let result;
  if (config.streaming) {
    res.setHeader('content-type', 'application/json; charset=utf-8');
    logger.info('### Streaming mode ###');
    result = utils.stream.createReadable();
    result.pipe(JSONStream.stringify()).pipe(res);
  } else {
    logger.info('### NO Streaming mode ###');
    result = [];
  }

  stateManager({
    id: agreementId
  }).then(function (manager) {
    logger.info('Preparing requests to /states/' + agreementId + '/metrics/{metricId} : ');

    const validationErrors = [];
    if (config.parallelProcess.metrics) {
      const promises = [];
      Object.keys(manager.agreement.terms.metrics).forEach(function (metricId) {
        const query = new Query(req.query);
        const validation = utils.validators.metricQuery(query, metricId, manager.agreement.terms.metrics[metricId]);
        if (!validation.valid) {
          validation.metric = metricId;
          validationErrors.push(validation);
        } else {
          promises.push(manager.get('metrics', query));
        }
      });

      if (validationErrors.length === 0) {
        utils.promise.processParallelPromises(manager, promises, result, res, config.streaming);
      } else {
        res.status(400).json(new ErrorModel(400, validationErrors));
      }
    } else {
      const metricsQueries = [];
      Object.keys(manager.agreement.terms.metrics).forEach(function (metricId) {
        const query = new Query(req.query);
        const validation = utils.validators.metricQuery(query, metricId, manager.agreement.terms.metrics[metricId]);
        if (!validation.valid) {
          validation.metric = metricId;
          validationErrors.push(validation);
        } else {
          metricsQueries.push(query);
        }
      });
      if (validationErrors.length === 0) {
        utils.promise.processSequentialPromises('metrics', manager, metricsQueries, result, res, config.streaming);
      } else {
        res.status(400).json(new ErrorModel(400, validationErrors));
      }
    }
  }, function (err) {
    logger.error('ERROR processing metrics');
    res.status(500).json(new ErrorModel(500, err));
  });
}

/**
 * GET all the states of a metric by metric's ID.
 * @param {Object} args {agreement: String, metric: String}
 * @param {Object} res response
 * @param {Object} next next function
 * @alias module:metrics.modifyMetricById
 * */
function getMetricStatesById (req, res) {
  const args = req.swagger.params;
  const agreementId = args.agreement.value;
  const metricId = args.metric.value;
  const query = new Query(req.query);

  let result;
  if (config.streaming) {
    logger.info('### Streaming mode ###');
    res.setHeader('content-type', 'application/json; charset=utf-8');
    result = utils.stream.createReadable();
    result.pipe(JSONStream.stringify()).pipe(res);
  } else {
    logger.info('### NO Streaming mode ###');
    result = [];
  }

  stateManager({
    id: agreementId
  }).then(function (manager) {
    const validation = utils.validators.metricQuery(query, metricId, manager.agreement.terms.metrics[metricId]);
    if (!validation.valid) {
      logger.error('Query validation error');
      res.status(400).json(new ErrorModel(400, validation));
    } else {
      manager.get('metrics', query).then(function (data) {
        if (config.streaming) {
          res.json(data.map(function (element) {
            return manager.current(element);
          }));
        } else {
          data.forEach(function (element) {
            result.push(manager.current(element));
          });
          result.push(null);
        }
      }).catch(function (err) {
        const errorString = 'Error retrieving state values of metric: ' + metricId;
        controllerErrorHandler(res, 'metrics-controller', '_getMetricStatesById', 500, errorString, err);
      });
    }
  }).catch(function (err) {
    logger.error(err);
    res.status(500).json(new ErrorModel(500, err));
  });
}

/**
 * States filter
 * @param {Object} req {agreement: String}
 * @param {Object} res response
 * @param {Object} next next function
 * @alias module:agreements.getAgreementsStatesFiltered
 * */
function getAgreementsStatesFiltered (req, res) {
  logger.info('New request to GET filtered agreements states (states/agreements/agreements.js) with params: ' + JSON.stringify(req.query));

  const agreementId = req.swagger.params.agreement.value;
  const indicator = req.query.indicator;
  const type = req.query.type;
  const from = req.query.from;
  const to = req.query.to;
  const at = req.query.at;

  // Recreate scopes object
  const scopeQuery = {};
  let groupQuery = {};
  for (const property in req.query) {
    if (property.startsWith('scope.')) {
      if (req.query[property] === '*') {
        scopeQuery[property] = {
          $exists: true
        };
      } else {
        if (req.query[property] === NaN) {
          scopeQuery[property] = {

            $eq: req.query[property]
          };
        } else {
          scopeQuery[property] = {

            $eq: parseInt(req.query[property])
          };
        }
      }

      groupQuery = {
        $group: { _id: '$' + property, evidences: { $push: '$records.evidences' } }
      };
    }
  }

  const StateModel = db.models.StateModel;

  const andQuery = {
    agreementId: {
      $eq: agreementId
    },
    id: {
      $eq: indicator
    },
    stateType: {
      $eq: type
    },
    'period.from': {
      $eq: from || at
    }

  };

  if (to) {
    Object.assign(andQuery, {
      'period.to': {
        $eq: to
      }
    });
  }

  Object.assign(andQuery, scopeQuery); // Concat scope properties to the query

  StateModel.aggregate([{
    $match: {
      $and: [andQuery]
    }
  },
  {
    $unwind: '$records'
  }
    //, groupQuery?groupQuery:{}

  ])
    .allowDiskUse(true)
    .cursor()
    .exec()
    .pipe(JSONStream.stringify())
    .pipe(res);
}

/**
 * Reload an agreement state by agreement ID.
 * @param {Object} args {agreement: String, from: String, to: String}
 * @param {Object} res response
 * @param {Object} next next function
 * @alias module:agreements.recalculateAgreementStateById
 * */
function recalculateAgreementStateById (args, res) {
  const agreementId = args.agreements.value;
  const parameters = args.parameters.value;

  logger.info('New request to reload state of agreement ' + agreementId);

  const StateModel = db.models.StateModel;
  StateModel.find({
    agreementId: agreementId
  }).remove(function (err) {
    const errors = [];
    if (!err) {
      const message = 'Reloading state of agreement ' + agreementId + '. '
      res.end(message);

      logger.info('Deleted state for agreement ' + agreementId);

      const AgreementModel = db.models.AgreementModel;
      AgreementModel.findOne({
        id: agreementId
      }, function (err, agreement) {
        if (err) {
          logger.error(err.toString());
          errors.push(err);
        }
        stateManager({
          id: agreementId
        }).then(function (manager) {
          logger.info('Calculating agreement state...');
          calculators.agreementCalculator.process(manager, parameters.requestedState).then(function () {
            logger.debug('Agreement state has been calculated successfully');
            if (errors.length > 0) {
              logger.error('Agreement state reload has been finished with ' + errors.length + ' errors: \n' + JSON.stringify(errors));
            } else {
              logger.info('Agreement state reload has been finished successfully');
            }
          }, function (err) {
            logger.error(err.message.toString());
            errors.push(err);
          });
        }, function (err) {
          logger.error(err.message.toString());
          errors.push(err);
        });
      });
    } else {
      logger.error("Can't delete state for agreement " + agreementId + ' :' + err);
      errors.push(err);
    }
  });
}