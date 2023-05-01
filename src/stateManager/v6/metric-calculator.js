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
const logger = governify.getLogger().tag('metric-calculator');

import { handleError } from '../../utils/errors.js';

/**
 * Metric calculator module.
 * @module metricCalculator
 * @requires config
 * @requires request
 * @requires JSONStream
 * @see module:calculators
 * */
module.exports = {
  processAllMetrics
};

/**
 * Process all metrics.
 * @param {Object} agreement agreement
 * @param {Object} metricId metric ID
 * @param {Object} metricQuery metric query object
 * @alias module:metricCalculator.processAllMetrics
 * */
async function processAllMetrics(agreement, metricId) {
  try {
    const metric = agreement.terms.metrics[metricId];
    if (!metric) {
      throw handleError('metrics', 'processAllMetrics', 404, `Metric '${metricId}' not found.`)
    }

    const collector = metric.collector;
    logger.info(`Using collector type: ${collector.type}`);

    if (collector.type !== 'POST-GET-V1') {
      console.error(`This Registry does not implement the collector type: ${collector.type}`);
      return {};
    }

    const metricRequest = await governify.infrastructure.getService(collector.infrastructurePath).request({
      url: collector.endpoint,
      method: 'POST',
      data: { config: collector.config, metric: metric.measure }
    });

    const computationResults = await getComputationV2(collector.infrastructurePath, `/${metricRequest.data.computation.replace(/^\//, '')}`, 60000);

    if (!Array.isArray(computationResults)) {
      throw handleError('metrics', 'processAllMetrics', 500, `Error in computer response for metric: ${metricId}. Response is not an array: ${JSON.stringify(monthMetrics)}`);
    }

    return { metricId, metricValues: computationResults };
  } catch (err) {
    throw handleError('metrics', 'processAllMetrics', 500, `Error processing computer response for metric: ${metricId}`, err);
  }
}

/**
 * Obtains calculation from v2 API.
 * @param {Object} computationId computation ID
 * @param {Object} timeout Time between retrying requests in milliseconds
 * */
async function getComputationV2(infrastructurePath, computationURL, ttl) {
  const RETRY_TIMEOUT = 1000;

  try {
    if (ttl < 0) {
      throw handleError('metrics', 'getComputationV2', 500, 'Retries time surpassed TTL.');
    }

    const response = await governify.infrastructure.getService(infrastructurePath).get(computationURL);

    if (response.status === 200) {
      return response.data.computations;
    }

    if (response.status === 202) {
      console.log(`Computation ${computationURL.split('/').pop()} not ready yet. Retrying in ${RETRY_TIMEOUT}ms.`);
      await new Promise(resolve => setTimeout(resolve, RETRY_TIMEOUT));
      return getComputationV2(infrastructurePath, computationURL, ttl - RETRY_TIMEOUT);
    }

    throw handleError('metrics', 'getComputationV2', 500, 'Invalid response status from collector', response);
  } catch (err) {
    if (err?.response?.status === 400) {
      console.error(`Failed obtaining computations from collector: ${err.response.data.errorMessage}\nCollector used: ${infrastructurePath}\nEndpoint: ${computationURL}`);
      return [];
    }

    console.error(`Error when obtaining computation response from collector: ${infrastructurePath} - ComputationURL: ${computationURL} - ERROR: ${err}`);
    throw handleError('metrics', 'getComputationV2', 500, 'Error obtaining computation response from collector', err);
  }
}