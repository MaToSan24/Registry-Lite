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

import { handlePromiseError } from '../../utils/errors.js';
import { processSequentialPromises } from '../../utils/promise.js';
import moment from 'moment-timezone';

/**
 * Agreement calculator module.
 * @module agreementCalculator
 * @requires config
 * @see module:calculators
 * */
module.exports = {
  processAgreement
};

/**
 * Process agreement.
 * @param {Object} manager manager
 * @param {Object} parameters parameters
 * @param {date} from from date
 * @param {date} to to date
 * @alias module:processAgreement
 */
async function processAgreement(manager, parameters = {}) {
  try {
    const guaranteeResults = await processGuarantees(manager, parameters);
    const metricResults = await processMetrics(manager, parameters);
    return guaranteeResults.concat(metricResults);
  } catch (error) {
    logger.error(error);
    throw error;
  }
}

/**
 * Process metrics.
 * @function processMetrics
 * @param {Object} manager manager
 * @param {Object} parameters parameters
 */
async function processMetrics(manager, parameters) {
  // If metrics are not specified, process all metrics
  const metricIds = parameters.metrics ? Object.keys(manager.agreement.terms.metrics).filter(metricId => parameters.metrics[metricId]) : Object.keys(manager.agreement.terms.metrics);
  const queries = metricIds.filter(metricId => manager.agreement.terms.metrics[metricId].defaultStateReload).map(metricId => createMetricQuery(manager, metricId));

  logger.debug('Processing metrics in sequential mode');
  logger.debug('- metrics: ' + metricIds);

  try {
    return await processSequentialPromises('metrics', manager, queries, null);
  } catch (err) {
    return handlePromiseError(reject, 'agreements', processMetrics.name, err.code || 500, 'Error processing agreements', err);
  }
}

// Helper function to create a metric query
function createMetricQuery(manager, metricId) {
  const metricDef = manager.agreement.terms.metrics[metricId];
  const scope = metricDef.scope
    ? Object.keys(metricDef.scope).reduce((result, key) => {
        result[key] = metricDef.scope[key]?.default ?? '*';
        return result;
      }, { priority: 'P2' })
    : null;

  const initial = moment.utc(moment.tz(metricDef.window.initial, manager.agreement.context.validity.timeZone)).format('YYYY-MM-DDTHH:mm:ss.SSS') + 'Z';
  return {
    metric: metricId,
    ...(scope ? { scope } : {}),
    parameters: {},
    evidences: [],
    window: {
      initial,
      timeZone: manager.agreement.context.validity.timeZone,
      period: metricDef.window.period,
      type: metricDef.window.type
    },
    period: {
      from: '*',
      to: '*'
    }
  };
}

/**
 * Process guarantees.
 * @function processGuarantees
 * @param {Object} manager manager
 * @param {Object} parameters parameters
 * */
async function processGuarantees(manager, parameters) {
  try {
    const guarantees = parameters?.guarantees
      ? manager.agreement.terms.guarantees.filter(guarantee => Object.keys(parameters.guarantees).includes(guarantee.id))
      : manager.agreement.terms.guarantees;

    logger.debug('Processing guarantees in sequential mode');
    logger.debug('- guarantees: ', guarantees);

    const guaranteeQueries = guarantees.map(guarantee => ({ guarantee: guarantee.id }));

    const result = await processSequentialPromises('guarantees', manager, guaranteeQueries, null);
    return result;
  } catch (error) {
    logger.error(error);
    throw error;
  }
}
