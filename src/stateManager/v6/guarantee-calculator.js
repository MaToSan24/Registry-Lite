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
const logger = governify.getLogger().tag('guarantee-calculator');
const utils = require('../../utils');

const promiseErrorHandler = utils.errors.promiseErrorHandler;
const Error = utils.errors.Error;

const Promise = require('bluebird');
const vm = require('vm');

/**
 * Guarantee calculator module.
 * @module guaranteeCalculator
 * @requires config
 * @requires utils
 * @requires bluebird
 * @requires vm
 * @see module:calculators
 * */
module.exports = {
  processAll: processGuarantees,
  process: processGuarantee
};

/**
 * Process all guarantees.
 * @param {Object} agreement agreement
 * @alias module:guaranteeCalculator.processAll
 * */
function processGuarantees (agreement, forceUpdate) {
  return new Promise(function (resolve, reject) {
    const processGuarantees = [];

    // processGuarantee is called for each guarantee of the agreement guarantees definition
    agreement.terms.guarantees.forEach(function (guarantee) {
      processGuarantees.push(processGuarantee(agreement, guarantee.id, true));
    });

    utils.promise.processParallelPromises(null, processGuarantees, null, null, null)
      .then(resolve)
      .catch(function (err) {
        const errorString = 'Error processing guarantees';
        return promiseErrorHandler(reject, 'guarantees', 'processGuarantees', 500, errorString, err);
      });
  });
}

/**
 * Process a single guarantees.
 * @param {Object} agreement agreement
 * @param {Object} guaranteeId guarantee ID
 * @param {Object} manager manager
 * @alias module:guaranteeCalculator.process
 * */
function processGuarantee (manager, query, forceUpdate) {
  const agreement = manager.agreement;
  const guaranteeId = query.guarantee;

  return new Promise((resolve, reject) => {
    logger.debug("Searching guarantee '%s' in array:\n %s", guaranteeId, JSON.stringify(agreement.terms.guarantees, null, 2));

    // We retrieve the guarantee definition from the agreement that matches with the provided ID
    const guarantee = agreement.terms.guarantees.find(function (guarantee) {
      return guarantee.id === guaranteeId;
    });

    logger.debug('Processing guarantee: ' + guaranteeId);
    if (!guarantee) {
      const errorString = 'Guarantee ' + guaranteeId + ' not found.';
      return promiseErrorHandler(reject, 'guarantees', 'processGuarantees', 404, errorString);
    }
    // We prepare the parameters needed by the processScopedGuarantee function
    const processScopedGuarantees = guarantee.of.reduce(function (acc, ofElement, index) {
      if (query.period) {
        logger.debug(index + '- ( processScopedGuarantee ) with query' + JSON.stringify(query, null, 2));
        var auxProcessScopedGuarantees = [...acc];
        auxProcessScopedGuarantees.push({
          manager: manager,
          query: query,
          guarantee: guarantee,
          ofElement: ofElement,
          forceUpdate: forceUpdate
        });
      }
      return auxProcessScopedGuarantees;
    }, []);

    let guaranteesValues = [];
    logger.debug('Processing scoped guarantee (' + guarantee.id + ')...');
    logger.debug('With query:  (' + JSON.stringify(query, null, 2) + ')...');
    // processScopedGuarantee is called for each scope (priority, node, serviceLine, activity, etc.) of the guarantee

    Promise.each(processScopedGuarantees, function (guaranteeParam) {
      return processScopedGuarantee(guaranteeParam.manager, guaranteeParam.query, guaranteeParam.guarantee, guaranteeParam.ofElement, guaranteeParam.forceUpdate).then(function (value) {
        logger.debug('Scoped guarantee has been processed');
        // Once we have calculated the scoped guarantee state, we add it to the array 'guaranteeValues'
        guaranteesValues = guaranteesValues.concat(value);
      });
      // This catch will be controller by the each.catch in order to stop
      // the execution when 1 promise fails
    }).then(function () {
      logger.debug('All scoped guarantees have been processed');
      // Once we have calculated all scoped guarantees, we return guarantee ID and guarantee states values
      return resolve({
        guaranteeId: guaranteeId,
        guaranteeValues: guaranteesValues
      });
    }).catch(function (err) {
      const errorString = 'Error processing scoped guarantee for: ' + guarantee.id;
      return promiseErrorHandler(reject, 'guarantees', 'processGuarantee', 500, errorString, err);
    });
  });
}

/**
 * Process a scoped guarantee.            // MODIFY METHOD IN ORDER TO REMOVE PENALTIES FROM THE CALCULATION
 * @function processScopedGuarantee
 * @param {Object} agreement agreement
 * @param {Object} guarantee guarantee
 * @param {Object} ofElement of element
 * @param {Object} manager manager
 * */
function processScopedGuarantee (manager, query, guarantee, ofElement, forceUpdate) {
  try {
    return new Promise((resolve, reject) => {
      const agreement = manager.agreement;

      // We retrieve the SLO from the scoped guarantee and the penalties to apply
      const slo = ofElement.objective;
      const penalties = ofElement.penalties;
      const processMetrics = [];
      // If some scope is not specified, we set it with default values
      const scopeWithDefault = {};
      const definedScopes = Object.keys(ofElement.scope || {});
      for (const guaranteeScope in guarantee.scope) {
        if (definedScopes.indexOf(guaranteeScope) > -1) {
          scopeWithDefault[guaranteeScope] = ofElement.scope[guaranteeScope];
        } else if (guarantee.scope[guaranteeScope].default) {
          scopeWithDefault[guaranteeScope] = guarantee.scope[guaranteeScope].default;
        }
      }
      // We collect the evidences that will be send to computer
      const evidences = [];
      if (ofElement.evidences) {
        ofElement.evidences.forEach(function (evidence) {
          const evidenceId = Object.keys(evidence)[0];
          const evidenceComputer = evidence[evidenceId].computer;
          if (evidenceComputer) {
            evidences.push({
              id: evidenceId,
              computer: evidenceComputer.url.replace(/\/$/, '') + '/api/v' + evidenceComputer.apiVersion + '/' + evidenceComputer.name.replace(/^\//, '')
            });
          }
        });
      }
      // We get the metrics to calculate from the with section of the scoped guarantee
      if (ofElement.with) {
        const window = ofElement.window;
        window.initial = query.period.from;
        if (query.period && query.period.to) {
          window.end = query.period.to;
        }
        window.timeZone = agreement.context.validity.timeZone;
        // For each metric, we create an object with the parameters needed by the manager to be able to calculate the metric state
        for (const metricId in ofElement.with) {
          processMetrics.push({
            metric: metricId,
            scope: scopeWithDefault,
            parameters: ofElement.with[metricId],
            evidences: evidences,
            window: window,
            period: {
              from: query.period ? query.period.from : '*',
              to: query.period ? query.period.to : '*'
            },
            forceUpdate: forceUpdate
          });
        }
      }
      // timedScope array will group all metric values by the same scope and period
      // logger.warn("This scopedGuarantee need these metric: " + JSON.stringify(processMetrics, null, 2));
      const timedScopes = [];
      const metricValues = [];
      logger.debug('Obtaining required metrics states for scoped guarantee ' + guarantee.id + '...');
      Promise.each(processMetrics, function (metricParam) {
        return manager.get('metrics', metricParam, metricParam.forceUpdate).then(function (scopedMetricValues) {
          // Once we have all metrics involved in the scoped guarantee calculated...
          if (scopedMetricValues.length > 0) {
            logger.debug('Timed scoped metric values for ' + scopedMetricValues[0].id + ' has been calculated (' + scopedMetricValues.length + ') ');
            logger.debug('Updating timed scope array for ' + scopedMetricValues[0].id + '...');
            // For each scoped metric value...
            scopedMetricValues.forEach(function (metricValue) {
              const ts = {
                scope: metricValue.scope,
                period: metricValue.period
              };
              // We check if a timedScope exists
              let tsIndex = utils.containsObject(ts, timedScopes);
              if (tsIndex == -1) {
                // If no exists, we create it
                tsIndex = timedScopes.push(ts) - 1;
                logger.debug('New TimedScope with index: ', tsIndex);
              } else {
                logger.debug('TimedScope already exists in array index: ', tsIndex);
              }

              // If array metricValues has no values for the index yet, we initialize it
              if (metricValues[tsIndex] == null) {
                metricValues[tsIndex] = {};
              }
              // Finally, we store current value (most recent value) of the metric
              metricValues[tsIndex][metricValue.id] = manager.current(metricValue);
            });
            logger.debug('Timed scope array updated for ' + scopedMetricValues[0].id);
            logger.debug('Timed scope: ' + JSON.stringify(timedScopes, null, 2));
            logger.debug('Metric value: ' + JSON.stringify(metricValues, null, 2));
          } else {
            logger.debug('No metrics found for parameters: ' + JSON.stringify(metricParam, null, 2));
          }
        });
        // This catch will be controller by the each.catch in order to stop
        // the execution when 1 promise fails
      }).then(function () {
        const guaranteesValues = [];
        logger.debug('Calculating penalties for scoped guarantee ' + guarantee.id + '...');
        for (let index = 0; index < timedScopes.length; index++) {
          const guaranteeValue = calculatePenalty(agreement, guarantee, ofElement, timedScopes[index], metricValues[index], slo, penalties);
          if (guaranteeValue) {
            guaranteesValues.push(guaranteeValue);
          }
        }
        // Temporal fix

        logger.debug('All penalties for scoped guarantee ' + guarantee.id + ' calculated.');
        logger.debug('Guarantees values: ' + JSON.stringify(guaranteesValues, null, 2));
        return resolve(guaranteesValues);
      }).catch(function (err) {
        const errorString = 'Error processing timedScopes metrics for guarantee: ' + guarantee.id;
        return promiseErrorHandler(reject, 'guarantees', 'processScopedGuarantee', 500, errorString, err);
      });
    });
  } catch (err) {
    // Controlling errors that are not in promises
    const error = new Error(500, '', err);
    logger.error(error.toString());
  }
}

/**
 * Calculate a penalty.
 * @function calculatePenalty
 * @param {Object} agreement agreement
 * @param {Object} guarantee guarantee
 * @param {Object} ofElement of element
 * @param {Object} timedScope timed scope
 * @param {Object} metricsValues metric values
 * @param {Object} slo SLO
 * @param {Object} penalties penalties
 * */
function calculatePenalty (agreement, guarantee, ofElement, timedScope, metricsValues, slo, penalties) {
  const guaranteeValue = {};
  guaranteeValue.scope = timedScope.scope;
  guaranteeValue.period = timedScope.period;
  guaranteeValue.guarantee = guarantee.id;
  guaranteeValue.evidences = [];
  guaranteeValue.metrics = {};
  const values = [];
  var penalties = {};// Temporal fix

  for (const metricId in ofElement.with) {
    let value = 0;
    if (metricsValues[metricId]) {
      value = metricsValues[metricId].value;
    }
    if (value === 'NaN' || value === '') {
      logger.warn('Unexpected value (' + value + ') for metric ' + metricId + ' ');
      return;
    }
    vm.runInThisContext(metricId + ' = ' + value);
    guaranteeValue.metrics[metricId] = value;
    if (metricsValues[metricId] && metricsValues[metricId].evidences) {
      guaranteeValue.evidences = guaranteeValue.evidences.concat(metricsValues[metricId].evidences);
    } else {
      logger.warn('Metric without evidences: ' + JSON.stringify(metricsValues[metricId], null, 2));
    }

    const val = {};
    val[metricId] = value;
    values.push(val);
  }

  const fulfilled = Boolean(vm.runInThisContext(slo));
  guaranteeValue.value = fulfilled;

  if (!fulfilled && penalties.length > 0) {
    guaranteeValue.penalties = {};
    penalties.forEach(function (penalty) {
      const penaltyVar = Object.keys(penalty.over)[0];
      const penaltyFulfilled = penalty.of.filter(function (compensationOf) {
        return vm.runInThisContext(compensationOf.condition);
      });
      if (penaltyFulfilled.length > 0) {
        guaranteeValue.penalties[penaltyVar] = parseFloat(vm.runInThisContext(penaltyFulfilled[0].value));
      } else {
        guaranteeValue.penalties[penaltyVar] = 0;
        logger.error('SLO not fulfilled and no penalty found: ');
        logger.error('\t- penalty: ', penalty.of);
        logger.error('\t- metric value: ', values);
      }
    });
  }
  return guaranteeValue;
}
