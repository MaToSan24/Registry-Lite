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
const logger = governify.getLogger().tag('state-manager');

import { processAgreement } from '../../stateManager/v6/agreement-calculator.js';
import { processGuarantee } from '../../stateManager/v6/guarantee-calculator.js';
import { processAllMetrics } from '../../stateManager/v6/metric-calculator.js';
import { ErrorModel } from '../../utils/errors.js';
import Agreement from '../../models/Agreement.js';
import State from '../../models/State.js';

/**
 * State manager module.
 * @module stateManager
 * @requires config
 * @requires database
 * @requires errors
 * @requires requestretry
 * */
module.exports = initialize;

/**
 * Initialize the StateManager for an agreement.
 * @param {String} agreement agreement ID
 * @alias module:stateManager.initialize
 * */
async function initialize(agreement) {
  try {
    logger.debug(`(initialize) Initializing state with agreement ID = ${agreement.id}`);
    const agreementDoc = await Agreement.findOne({ id: agreement.id });
    if (!agreementDoc) throw new ErrorModel(404, `There is no agreement with id: ${agreement.id}`);
    logger.debug(`StateManager for agreementID = ${agreement.id} initialized`);

    const stateManager = {
      agreement: agreementDoc,  // agreement ==> agreement definition
      get,                      // get ==> gets one or more states
      put,                      // put ==> save an scoped state
      update,                   // update ==> calculates one or more states and save them
      current,                  // current ==> returns the most recent record for this state along with some additional info about the state
    };

    return stateManager;
  } catch (error) {
    logger.error(error.toString());
    throw new ErrorModel(500, error);
  }
}

/**
 * Gets one or more states by an specific query.
 * @function get
 * @param {String} stateType enum: {guarantees, agreement, metrics}
 * @param {StateManagerQuery} query query will be matched with an state.
 * */
async function get(stateType, query = {}, forceUpdate) {
  const stateManager = this;
  logger.debug(`(GET) Retrieving states of type '${stateType}' for query = ${JSON.stringify(query)} (ForceUpdate: ${forceUpdate})`);

  try {
    // projectionBuilder(query) removes the fields whose values are "*" from the query
    const result = await State.find(projectionBuilder({ agreementId: stateManager.agreement.id, stateType, ...query, id: query[stateType] }));

    if (result.length > 0) {
      logger.debug(`There are ${stateType} states for query = ${JSON.stringify(query)} in the database. Refreshing states...`);
      return await stateManager.update(stateType, query, 0, forceUpdate);
    } else {
      logger.debug(`There are not ${stateType} states for query = ${JSON.stringify(query)} in the database. Adding states...`);
      return await stateManager.update(stateType, query, 0, forceUpdate);
    }
  } catch (error) {
    logger.debug("Error: ", error);
    throw new ErrorModel(500, `Error while retrieving ${stateType} states: ${error.toString()}`);
  }
}


/**
 * Add states with an specific query.
 * @function put
 * @param {String} stateType enum: {guarantees, agreement, metrics}
 * @param {StateManagerQuery} query query will be matched with an state.
 * @param {Object} value value
 * @param {Object} metadata {logsState, evidences, parameters}.
 * */
async function put(stateType, query, value, metadata) {
  const stateManager = this;
  logger.debug(`(PUT) Saving state of ${stateType}`);

  const refinedQuery = { agreementId: stateManager.agreement.id, stateType, ...query, id: query[stateType] };
  const dbQuery = projectionBuilder(refinedQuery);
  logger.debug(`Updating ${stateType} state with refinedQuery = ${JSON.stringify(dbQuery, null, 2)}`);

  try {
    const record = { value, time: new Date().toISOString(), ...metadata };
    const result = await State.updateMany(dbQuery, { $push: { records: record } });
    logger.debug(`Updated record: ${JSON.stringify(result)}`);

    // Check if there is already a state
    if (result.nModified === 0) {
      logger.debug(`Creating new ${stateType} state with the record...`);
      await State.create({ ...refinedQuery, records: [record] });
    } else {
      logger.debug(`Inserted new record of ${stateType} state.`);
    }

    return await State.find(dbQuery);
  } catch (err) {
    logger.debug(`Error. It is not possible to update state with this query = ${JSON.stringify(query)}`);
    throw new ErrorModel(500, err);
  }
}

/**
 * Modify states with an specific query.
 * @function update
 * @param {String} stateType enum: {guarantees, agreement, metrics}
 * @param {StateManagerQuery} query query will be matched with an state.
 * @param {Object} logsState logsState
 * */
async function update(stateType, query, logsState, forceUpdate) {
  try {
    const stateManager = this;
    logger.debug(`(UPDATE) Updating state of ${stateType}`);

    switch (stateType) {
      case 'agreement':
        return await processAgreement(stateManager);

      case 'guarantees':
        const guaranteeStates = await processGuarantee(stateManager, query, forceUpdate);

        const processGuarantees = guaranteeStates.guaranteeValues.map(guaranteeState => {
          const state = { guarantee: query.guarantee, period: guaranteeState.period, scope: guaranteeState.scope };
          const options = { metrics: guaranteeState.metrics, evidences: guaranteeState.evidences };
          return stateManager.put(stateType, state, guaranteeState.value, options);
        });

        logger.debug('Persisting guarantee states...');
        const guarantees = await Promise.all(processGuarantees);
        logger.debug('All guarantee states have been persisted');
        return guarantees.map(guarantee => guarantee[0]);

      case 'metrics':
        const metricStates = await processAllMetrics(stateManager.agreement, query.metric, query);

        const processMetrics = metricStates.metricValues.map(metricValue => {
          const state = { metric: query.metric, scope: metricValue.scope, period: metricValue.period, window: query.window };
          const options = { evidences: metricValue.evidences, parameters: metricValue.parameters };
          return stateManager.put(stateType, state, metricValue.value, options);
        });

        logger.debug('Persisting metric states...');
        const metrics = await Promise.all(processMetrics);
        logger.debug('All metric states have been persisted');
        return metrics.map(metric => metric[0]);

      default:
        throw new ErrorModel(500, `There are no methods implemented to calculate ${stateType} state`);
    }
  } catch (err) {
    logger.error(err.toString());
    throw new ErrorModel(500, err);
  }
}

/**
 * current.
 * @function current
 * @param {Object} state state
 * @return {object} state
 * */
function current(state) {
  const newState = {
    stateType: state.stateType,
    agreementId: state.agreementId,
    id: state.id,
    scope: state.scope,
    period: state.period,
    window: state.window
  };
  const currentRecord = state.records[state.records.length - 1];
  for (const v in currentRecord) {
    if (v !== 'time' && v !== 'logsState') {
      newState[v] = currentRecord[v];
    }
  }
  return newState;
}

/**
 * Refine the query for a search in database.
 * @function projectionBuilder
 * @param {String} query query that will be matched with an state.
 * @return {String} mongo projection
 * */
function projectionBuilder(query) {
  const filteredQuery = { ...query };
  for (const [propName, propValue] of Object.entries(query)) {
    if (typeof propValue === 'object') {
      for (const [subPropName, subPropValue] of Object.entries(propValue)) {
        if (subPropValue === '*') {
          delete filteredQuery[propName][subPropName];
        }
      }
    } else if (propValue === '*') {
      delete filteredQuery[propName];
    }
  }
  logger.debug(`Mongo projection: ${JSON.stringify(projection, null, 2)}`);
  return filteredQuery;
}