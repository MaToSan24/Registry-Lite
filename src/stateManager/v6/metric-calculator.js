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
const JSONStream = require('JSONStream');

import { parseToQueryParams } from '../../utils/query.js';
import { handlePromiseError } from '../../utils/errors.js';
import { computerToRegistryParser, registryToComputerParser } from '../../utils/scopes.js';

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
function processAllMetrics(agreement, metricId, metricQuery) {
  return new Promise(async function (resolve, reject) {
    try {
      var metric = agreement.terms.metrics[metricId];
      if (!metric) {
        return reject('Metric ' + metricId + ' not found.');
      }

      const collector = metric.collector;

      /** ### BUILD COMPUTER REQUEST QUERY ###**/
      var collectorQuery = {};
      collectorQuery.parameters = metricQuery.parameters;
      collectorQuery.window = metricQuery.window;

      if (metricQuery.evidences) {
        collectorQuery.evidences = metricQuery.evidences;
      }

      var scope = metricQuery.scope;

      logger.info('Using collector type: ' + collector.type);

      if (collector.type === 'GET-V1') {
        logger.error('This registry version is not compatible with the collector type:', collector.type);
        return resolve({});
      } else if (collector.type === 'POST-GET-V1') {
        metric.measure.scope = Object.keys(scope).length > 0 ? scope : metricQuery.scope;
        metric.measure.window = metricQuery.window;
        var compositeResponse = [];
        const requestMetric = await governify.infrastructure.getService(collector.infrastructurePath).request({
          url: collector.endpoint,
          method: 'POST',
          data: { config: collector.config, metric: metric.measure }
        }
        ).catch(err => {
          const errorString = 'Error in Collector response ' + err.response.status + ':' + err.response.data;
          return handlePromiseError(reject, 'metrics', processMetric.name, err.response.status, errorString);
        });
        const collectorResponse = requestMetric.data;
        const monthMetrics = await getComputationV2(collector.infrastructurePath, '/' + collectorResponse.computation.replace(/^\//, ''), 60000).catch(err => {
          const errorString = 'Error obtaining computation from computer: ' + metricId + '(' + err + ')';
          return handlePromiseError(reject, 'metrics', processMetric.name, 500, errorString, err);
        });

        try {
          // Check if computer response is correct
          if (monthMetrics && Array.isArray(monthMetrics)) {
            // For each state returned by computer map the scope
            monthMetrics.forEach(function (metricState) {
              if (metricState.log && metric.scope) {
                // Getting the correct log for mapping scope
                const logId = Object.keys(metricState.log)[0];
                const log = agreement.context.definitions.logs[logId];
                // doing scope mapping
                metricState.scope = computerToRegistryParser(metricState.scope, log.scopes);
              }
              // aggregate metrics in order to return all
              compositeResponse.push(metricState);
            });
            logger.info('Mapping of columns names in log processed.');

            return resolve({
              metricId: metricId,
              metricValues: compositeResponse
            });
          } else {
            const errorString = 'Error in computer response for metric: ' + metricId + '. Response is not an array:  ' + JSON.stringify(monthMetrics);
            return handlePromiseError(reject, 'metrics', processMetric.name, 500, errorString);
          }
        } catch (err) {
          const errorString = 'Error processing computer response for metric: ' + metricId;
          return handlePromiseError(reject, 'metrics', processMetric.name, 500, errorString, err);
        }
      } else if (collector.type === 'PPINOT-V1') { // For ppinot collector
        var metric = agreement.terms.metrics[metricId];
        if (!metric) {
          return reject('Metric ' + metricId + ' not found.');
        }

        const metricCollectorObject = metric.collector;

        /** ### BUILD COMPUTER REQUEST QUERY ###**/
        var collectorQuery = {};
        collectorQuery.parameters = metricQuery.parameters;
        collectorQuery.window = metricQuery.window;

        if (metricQuery.evidences) {
          collectorQuery.evidences = metricQuery.evidences;
        }

        // Select logs data. If metric has not log, select by default log.
        let logDefinition, logId;
        if (metric.log) {
          logId = Object.keys(metric.log)[0]; // control this potential error
          if (!logId) { throw new Error('The log field of metric is not well defined in the agreement'); }
          logDefinition = metric.log[logId];
        } else {
          // Search default log
          const agLogs = agreement.context.definitions.logs;
          for (const l in agLogs) {
            if (agLogs[l].default) {
              logId = l;
              logDefinition = agLogs[l];
              break;
            }
          }
          if (!logDefinition) { throw new Error('Agreement is not well defined. It Must has at least a default log.'); }
        }
        // Build logs field on computer request body //
        collectorQuery.logs = {};
        collectorQuery.logs[logId] = new LogField(
          logDefinition.uri,
          logDefinition.stateUri,
          logDefinition.terminator,
          logDefinition.structure
        );

        // Mapping of columns names in log
        var scope = registryToComputerParser(metricQuery.scope, logDefinition.scopes);

        // adding computer config
        collectorQuery.config = new Config(
          '',
          metricCollectorObject.config.schedules,
          metricCollectorObject.config.holidays || null,
          metricCollectorObject.config.measures
        );

        if (!collectorQuery.logs) {
          return reject('Log not found for metric ' + metricId + '. ' +
            'Please, specify metric log or default log.');
        }
        collectorQuery.scope = Object.keys(scope).length > 0 ? scope : metricQuery.scope;

        // ### PREPARE REQUEST ###
        // Build URL query that will use on computer request
        const urlParams = parseToQueryParams(collectorQuery);
        logger.debug('Sending URL params to computer:', urlParams);
        var compositeResponse = [];
        logger.info('Sending request to computer with params: %s', JSON.stringify(collectorQuery, null, 2));
        // Build and send computer request
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
        const requestMetric = await governify.infrastructure.getService(collector.infrastructurePath).request({
          url: collector.endpoint + '/' + metricCollectorObject.name.replace(/^\//, '') + '?' + encodeURI(urlParams),
          method: 'GET',
          responseType: 'stream'
        }).catch(err => {
          const errorString = 'Error in PPINOT Computer response ' + err.response.status + ':' + err.response.data;
          return handlePromiseError(reject, 'metrics', processMetric.name, err.response.status, errorString);
        });
        const requestStream = requestMetric.data;
        requestStream.pipe(JSONStream.parse()).on('data', monthMetrics => {
          try {
            // Check if computer response is correct
            if (monthMetrics && Array.isArray(monthMetrics)) {
              // For each state returned by computer map the scope
              monthMetrics.forEach(function (metricState) {
                if (metricState.log && metric.scope) {
                  // Getting the correct log for mapping scope
                  const logId = Object.keys(metricState.log)[0];
                  const log = agreement.context.definitions.logs[logId];
                  // doing scope mapping
                  metricState.scope = computerToRegistryParser(metricState.scope, log.scopes);
                }
                // aggregate metrics in order to return all
                compositeResponse.push(metricState);
              });
              logger.info('Mapping of columns names in log processed.');
            } else {
              const errorString = 'Error in computer response for metric: ' + metricId + '. Response is not an array:  ' + JSON.stringify(monthMetrics);
              return handlePromiseError(reject, 'metrics', processMetric.name, 500, errorString);
            }
          } catch (err) {
            const errorString = 'Error processing computer response for metric: ' + metricId;
            return handlePromiseError(reject, 'metrics', processMetric.name, 500, errorString, err);
          }
        }).on('end', function () {
          return resolve({
            metricId: metricId,
            metricValues: compositeResponse
          });
        });
      } else {
        console.error('This registry does not implement the collector type:', collector.type);
        return resolve({});
      }
    } catch (err) {
      const errorString = 'Error processing metric: ' + metricId + '(' + err + ')';
      return handlePromiseError(reject, 'metrics', processMetric.name, 500, errorString, err);
    }
  });
}

/**
 * Obtains calculation from v2 API.
 * @param {Object} computationId computation ID
 * @param {Object} timeout Time between retrying requests in milliseconds
 * */
function getComputationV2(infrastructurePath, computationURL, ttl) {
  return new Promise((resolve, reject) => {
    try {
      if (ttl < 0) { reject('Retries time surpased TTL.'); return; }
      const realTimeout = 1000; // Minimum = firstTimeout
      const firstTimeout = 500;
      setTimeout(async () => {
        governify.infrastructure.getService(infrastructurePath).get(computationURL).then(response => {
          if (response.status === 202) {
            logger.info('Computation ' + computationURL.split('/').pop + ' not ready jet. Retrying in ' + realTimeout + ' ms.');
            setTimeout(() => {
              resolve(getComputationV2(infrastructurePath, computationURL, ttl - realTimeout));
            }, realTimeout - firstTimeout);
          } else if (response.status === 200) {
            resolve(response.data.computations);
          } else {
            // FIXME - Not returning response
            reject(new Error('Invalid response status from collector. Response: \n', response));
          }
        }).catch(err => {
          if (err?.response?.status === 400) {
            logger.error('Failed obtaining computations from collector: ' + err.response.data.errorMessage + '\nCollector used: ' + infrastructurePath + '\nEndpoint: ' + computationURL);
            resolve([]);
          } else {
            logger.error('Error when obtaining computation response from collector: ', infrastructurePath, ' - ComputationURL: ', computationURL, '- ERROR: ', err);
            reject(err);
          }
        });
      }, firstTimeout);
    } catch (err) {
      reject(err);
    }
  });
}

// ### OBJECTS CONSTRUCTORS ###

// constructor of computer request config object
class Config {
  constructor(ptkey, schedules, holidays, measures) {
    this.measures = measures;
    this.ptkey = ptkey;
    this.schedules = schedules;
    this.holidays = holidays;
  }
}

// constructor of computer request log object
class LogField {
  constructor(uri, stateUri, terminator, structure) {
    if (!uri || !stateUri || !terminator || !structure) {
      throw new Error('The log field of metric is not well defined in the agreement, uri, stateUri, terminator and structure are required fields.');
    }
    this.uri = uri;
    this.stateUri = stateUri;
    this.terminator = terminator;
    this.structure = structure;
  }
}
