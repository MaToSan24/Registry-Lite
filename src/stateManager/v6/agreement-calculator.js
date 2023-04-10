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
const logger = governify.getLogger().tag('agreement-calculator');
const moment = require('moment');
const utils = require('../../utils');

const Promise = require('bluebird');
const promiseErrorHandler = utils.errors.promiseErrorHandler;

/**
 * Agreement calculator module.
 * @module agreementCalculator
 * @requires config
 * @requires bluebird
 * @see module:calculators
 * */
module.exports = {
  process: _process
};

/**
 * Process agreement.
 * @param {Object} manager manager
 * @param {Object} parameters parameters
 * @param {date} from from date
 * @param {date} to to date
 * @alias module:agreementCalculator.process
 * */

// from and to parameters in future versions , from, to
function _process (manager, parameters) {
  return new Promise(function (resolve, reject) {
    try {
      if (!parameters) {
        parameters = {};
      }
      // Process guarantees
      processGuarantees(manager, parameters).then(function (guaranteeResults) {
        // Process metrics
        processMetrics(manager, parameters).then(function (metricResults) {
          const ret = guaranteeResults.concat(metricResults);

          return resolve(ret);
        }, reject);
      }, reject);
    } catch (e) {
      logger.error(e);
      return reject(e);
    }
  });
}

/**
 * Process metrics.
 * @function processMetrics
 * @param {Object} manager manager
 * @param {Object} parameters parameters
 * */
function processMetrics (manager, parameters) {
  return new Promise(function (resolve, reject) {
    // Getting all guarantee from agreement to be calculated.
    let metrics = [];
    if (!parameters.metrics) {
      metrics = Object.keys(manager.agreement.terms.metrics);
    } else {
      for (const metricId in manager.agreement.terms.metrics) {
        if (Object.keys(parameters.metrics).indexOf(metricId) != -1) {
          metrics.push(metricId);
        }
      }
    }
    const processMetrics = [];
    if (config.parallelProcess.metrics && false) { // parallel process is not implemented correctly
      logger.debug('Processing metrics in parallel mode');
      logger.debug('- metrics: ' + metrics);

      // Setting up promise for executing in parallel mode
      metrics.forEach(function (metricId) {
        let priorities = ['P1', 'P2', 'P3'];
        if (metricId == 'SPU_IO_K00') {
          priorities = [''];
        }

        priorities.forEach(function (priority) {
          parameters.metrics[metricId].scope.priority = priority;
          processMetrics.push(manager.get('metrics', parameters.metrics[metricId]));
        });
      });

      // Executing in parallel
      utils.promise.processParallelPromises(manager, processMetrics, null, null, null).then(resolve, reject);
    } else {
      logger.debug('Processing metrics in sequential mode');
      logger.debug('- metrics: ' + metrics);

      // Setting up queries for executing in parallel mode
      metrics.forEach(function (metricId) {
        logger.debug('-- metricId: ' + metricId);

        const metricDef = manager.agreement.terms.metrics[metricId];
        if (metricDef.defaultStateReload) {
          // it's supposed that computer accepts always scope[key] = '*';
          let scope = null;
          if (metricDef.scope) {
            scope = {};
            const metricsScp = metricDef.scope;
            // for (var s in metricsScp) {
            //     var scopeType = metricsScp[s];
            for (const st in metricsScp) {
              scope[st] = metricsScp.default || '*';
            }
            // }
            if (!scope.priority) {
              scope.priority = 'P2';
            } // activate for PROSAS agreements
          }

          logger.debug('Scope for metricId=%s : %s', metricId, JSON.stringify(scope, null, 2));
          const query = {
            metric: metricId,
            scope: scope,
            parameters: {},
            evidences: [],
            window: {
              initial: moment.utc(moment.tz(metricDef.window.initial, manager.agreement.context.validity.timeZone)).format('YYYY-MM-DDTHH:mm:ss.SSS') + 'Z',
              timeZone: manager.agreement.context.validity.timeZone,
              period: metricDef.window.period,
              type: metricDef.window.type
            }, // how to get window
            period: {
              from: '*',
              to: '*'
            }
          };

          if (!scope) {
            delete query.scope;
          }
          logger.debug('query. ', JSON.stringify(query, null, 2));
          processMetrics.push(query);
        }
      });

      // Processing metrics in sequential mode.
      utils.promise.processSequentialPromises('metrics', manager, processMetrics, null, null, null)
        .then(resolve)
        .catch(function (err) {
          const errorString = 'Error processing agreements';
          return promiseErrorHandler(reject, 'agreements', processMetrics.name, err.code || 500, errorString, err);
        });
    }
  });
}

/**
 * Process guarantees.
 * @function processGuarantees
 * @param {Object} manager manager
 * @param {Object} parameters parameters
 * */
function processGuarantees (manager, parameters) {
  return new Promise(function (resolve, reject) {
    // Getting all guarantee from agreement to be calculated.
    let guarantees = [];
    if (!parameters.guarantees) {
      guarantees = manager.agreement.terms.guarantees;
    } else {
      guarantees = manager.agreement.terms.guarantees.filter(function (guarantee) {
        return Object.keys(parameters.guarantees).indexOf(guarantee.id) != -1;
      });
    }

    if (config.parallelProcess.guarantees) {
      logger.debug('Processing guarantees in parallel mode');
      logger.debug('- guarantees: ' + guarantees);

      // Setting up promise for executing in parallel mode
      const processGuarantees = [];
      guarantees.forEach(function (guarantee) {
        processGuarantees.push(manager.get('guarantees', {
          guarantee: guarantee.id
        }));
      });

      // Executing in parallel
      utils.promise.processParallelPromises(manager, processGuarantees, null, null, null).then(resolve, reject);
    } else {
      logger.debug('Processing guarantees in sequential mode');
      logger.debug('- guarantees: ' + guarantees);

      // Setting up queries for executing in parallel mode
      const guaranteeQueries = [];
      guarantees.forEach(function (element) {
        guaranteeQueries.push({
          guarantee: element.id
        });
      });

      // Executing sequentially
      utils.promise.processSequentialPromises('guarantees', manager, guaranteeQueries, null, null, null).then(resolve, reject);
    }
  });
}
