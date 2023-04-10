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
const config = governify.configurator.getConfig('main');
const logger = governify.getLogger().tag('metrics');

const ErrorModel = require('../../../../errors/index.js').errorModel;
const stateManager = require('../../../../stateManager/v6/state-manager');
const utils = require('../../../../utils');

const Query = utils.Query;
const JSONStream = require('JSONStream');
const controllerErrorHandler = utils.errors.controllerErrorHandler;

/**
 * Metrics module
 * @module metrics
 * @see module:states
 * @requires config
 * @requires bluebird
 * @requires JSONStream
 * @requires stream
 * @requires errors
 * @requires stateManager
 * */
module.exports = {
  increaseMetricById,
  modifyMetricById,
  getAllMetricsStates,
  getMetricStatesById
};

/**
 * Increase metric by ID.
 * @param {Object} args {agreement: String, metric: String}
 * @param {Object} res response
 * @param {Object} next next function
 * @alias module:metrics.increaseMetricById
 * */
function increaseMetricById (args, res) {
  const agreementId = args.agreement.value;
  const metricId = args.metric.value;
  const query = args.scope.value;

  logger.info('New request to increase metric = %s, with values = %s', metricId, JSON.stringify(query, null, 2));

  stateManager({
    id: agreementId
  }).then(function (manager) {
    query.metric = metricId;
    manager.get('metrics', query).then(function (metric) {
      logger.info('Result of getting metricValues: ' + JSON.stringify(metric, null, 2));
      logger.info('Query to put ' + JSON.stringify(query, null, 2));
      manager.put('metrics', query, manager.current(metric[0]).value + 1).then(function (success) {
        res.json(success.map(function (element) {
          return manager.current(element);
        }));
      }, function (err) {
        res.status(err.code).json(err);
      });
    }, function (err) {
      res.status(err.code).json(err);
    });
  }, function (err) {
    res.status(err.code).json(err);
  });
}

/**
 * Modify metric by ID.
 * @param {Object} args {agreement: String, metric: String, metricValue: String}
 * @param {Object} res response
 * @param {Object} next next function
 * @alias module:metrics.metricsIdPUT
 * */
function modifyMetricById (args, res) {
  const agreementId = args.agreement.value;
  const metricValue = args.metricValue.value;
  const metricId = args.metric.value;
  // var query = new Query(req.query);

  logger.info('New request to PUT metrics over: ' + metricId + ' with value: ' + metricValue);

  stateManager({
    id: agreementId
  }).then(function (manager) {
    manager.put('metrics', {
      metric: metricId,
      scope: metricValue.scope,
      window: metricValue.window
    }, metricValue.value).then(function (success) {
      res.json(success.map(function (element) {
        return manager.current(element);
      }));
    }, function (err) {
      res.status(err.code).json(err);
    });
  }, function (err) {
    res.status(err.code).json(err);
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
