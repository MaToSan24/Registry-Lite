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

const stateManager = require('../../stateManager/v6/state-manager.js');

// import ErrorModel from '../../utils/errors.js';

/**
 * Metrics module
 * @module metrics
 * @see module:states
 * @requires config
 * @requires errors
 * @requires stateManager
 * */
module.exports = {
  increaseMetricById,
  modifyMetricById
};

/**
 * Increase metric by ID.
 * @param {Object} args {agreement: String, metric: String}
 * @param {Object} res response
 * @param {Object} next next function
 * @alias module:metrics.increaseMetricById
 * */
async function increaseMetricById(args, res) {
  try {
    const agreementId = args.agreement.value;
    const metricId = args.metric.value;
    const query = args.scope.value;

    logger.info(`New request to increase metric = ${metricId}, with values = ${JSON.stringify(query, null, 2)}`);
    const manager = await stateManager({ id: agreementId });
    query.metric = metricId;
    const metric = await manager.get('metrics', query);
    logger.info(`Result of getting metricValues: ${JSON.stringify(metric, null, 2)}`);

    const newValue = manager.current(metric[0]).value + 1;
    logger.info(`Query to put ${JSON.stringify(query, null, 2)} with new value = ${newValue}`);
    const success = await manager.put('metrics', query, newValue);

    let result = success.map(element => manager.current(element));
    logger.info(`Result of increasing metric: ${JSON.stringify(result, null, 2)}`);
    res.send(result);
  } catch (err) {
    logger.error(err);
    res.status(err.code).send(err);
  }
}

/**
 * Modify metric by ID.
 * @param {Object} args {agreement: String, metric: String, metricValue: String}
 * @param {Object} res response
 * @param {Object} next next function
 * @alias module:metrics.modifyMetricById
 * */
async function modifyMetricById(args, res) {
  try {
    const agreementId = args.agreement.value;
    const metricValue = args.metricValue.value;
    const metricId = args.metric.value;

    logger.info(`New request to PUT metrics over: ${metricId} with value: ${JSON.stringify(metricValue)}`);
    const manager = await stateManager({ id: agreementId });
    const success = await manager.put('metrics', {
      metric: metricId,
      scope: metricValue.scope,
      window: metricValue.window
    }, metricValue.value);

    let result = success.map(element => manager.current(element));
    logger.info(`Result of modifying metric: ${JSON.stringify(result, null, 2)}`);
    res.send(result);
  } catch (err) {
    res.status(err.code).send(err);
  }
}