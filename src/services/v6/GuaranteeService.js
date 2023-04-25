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
const logger = governify.getLogger().tag('guarantees');

const stateManager = require('../../stateManager/v6/state-manager');
const Promise = require('bluebird');

import { ErrorModel, handleControllerError } from '../../utils/errors.js';
import Query from '../../utils/query.js';
import State from '../../models/State.js';
import { guaranteeQuery } from '../../utils/validators.js';
import { processSequentialPromises } from '../../utils/promise.js';
import { getPeriods, getLastPeriod } from '../../utils/timeAndPeriod.js';

/**
 * Guarantees module
 * @module guarantees
 * @see module:states
 * @requires config
 * @requires bluebird
 * @requires errors
 * @requires stateManager
 * */
module.exports = {
  getGuarantees,
  getAllGuarantees,
  getGuaranteeById,
};

/**
 * Method used internally. Get guarantees for a given agreement ID and guarantee ID within a specific date range.
 * @param {string} agreementId - The ID of the agreement to get guarantees for.
 * @param {string} guaranteeId - The ID of the guarantee to get.
 * @param {object} dateRange - The date range to get guarantees for.
 * @param {Date} dateRange.from - The start of the date range.
 * @param {Date} dateRange.to - The end of the date range.
 * @param {boolean} forceUpdate - Whether to force an update of the guarantees.
 * @returns {Promise} A promise that resolves with the guarantees or rejects with an error.
 */
async function getGuarantees(agreementId, guaranteeId, dateRange, forceUpdate) {
  try {
    const manager = await stateManager({ id: agreementId });
    const guaranteesQueries = [];
    const validationErrors = [];

    manager.agreement.terms.guarantees.forEach((guarantee) => {
      const queryM = buildGuaranteeQuery(guarantee.id, dateRange.from, dateRange.to);
      const validation = guaranteeQuery(queryM, guarantee.id, guarantee);

      if (!validation.valid) {
        validation.guarantee = guarantee.id;
        validationErrors.push(validation);
      } else {
        guaranteesQueries.push(queryM);
      }
    });

    if (validationErrors.length > 0) {
      logger.error('Error while getting guarantees: ' + JSON.stringify(validationErrors));
      throw new ErrorModel(400, validationErrors);
    }

    const result = await processSequentialPromises('guarantees', manager, guaranteesQueries, true);
    logger.info('Guarantees obtained successfully');
    return result;
  } catch (err) {
    logger.error('Error while getting guarantees for agreement: ' + agreementId + ' - ' + err);
    throw new ErrorModel(500, `Error while initializing state manager for agreement: ${agreementId} - ${err}`);
  }
}

/**
 * Get all guarantees.
 * @param {Object} args {agreement: String, from: String, to: String}
 * @param {Object} res response
 * @param {Object} next next function
 * @alias module:guarantees.getAllGuarantees
 * */
async function getAllGuarantees(req, res) {
  try {
    const agreementId = req.swagger.params.agreement.value;
    const { from, to, forceUpdate } = req.query;
    const lastPeriod = req.query.lastPeriod !== 'false';
    const newPeriodsFromGuarantees = req.query.newPeriodsFromGuarantees !== 'false';
    const validationErrors = [];

    logger.info(`New request to GET guarantees - With new periods from guarantees: ${newPeriodsFromGuarantees}`);
    const manager = await stateManager({ id: agreementId });
    logger.info('Getting state of guarantees...');
    const queries = getGuaranteesQueries(manager, req.query, validationErrors, from, to, lastPeriod, newPeriodsFromGuarantees);

    if (validationErrors.length > 0) {
      logger.error('Error while getting guarantees: ' + JSON.stringify(validationErrors));
      res.status(400).json(new ErrorModel(400, validationErrors));
    } else {
      logger.info('Getting guarantees...');
      processSequentialPromises('guarantees', manager, queries, forceUpdate === 'true');
    }
  } catch (err) {
    logger.error(`Error while processing guarantees: ${err}`);
    res.status(500).json(new ErrorModel(500, err.message));
  }
}

// Helper function for getAllGuarantees
function getGuaranteesQueries(manager, query, validationErrors, from, to, lastPeriod, newPeriodsFromGuarantees) {
  return manager.agreement.terms.guarantees.reduce((queries, guarantee) => {
    const guaranteeDefinition = manager.agreement.terms.guarantees.find(e => e.id === guarantee.id);
    const requestWindow = guaranteeDefinition.of[0].window;

    let allQueries = [];
    if (from && to) {
      requestWindow.from = from;
      requestWindow.end = to;
      const periods = newPeriodsFromGuarantees ? getPeriods(manager.agreement, requestWindow) : [{ from: new Date(from).toISOString(), to: new Date(to).toISOString() }];
      allQueries = periods.map(period => buildGuaranteeQuery(guarantee.id, period.from, period.to));
    } else if (lastPeriod) {
      const period = getLastPeriod(manager.agreement, requestWindow);
      allQueries.push(buildGuaranteeQuery(guarantee.id, period.from, period.to));
    } else {
      allQueries.push(guarantee.id);
    }

    allQueries.forEach(query => {
      const validation = guaranteeQuery(query, guarantee.id);
      if (!validation.valid) {
        validation.guarantee = guarantee.id;
        validationErrors.push(validation);
        logger.error('Error while getting guarantees: ' + JSON.stringify(validationErrors));
      } else {
        queries.push(query);
      }
    });
    return queries;
  }, []);
}

/**
 * Get guarantees by ID.
 * @param {Object} args {agreement: String, guarantee: String}
 * @param {Object} res response
 * @param {Object} next next function
 * @alias module:guarantees.getGuaranteeById
 * */
async function getGuaranteeById(req, res) {

  logger.info('New request to GET guarantee');

  const { agreement: { value: agreementId }, guarantee: { value: guaranteeId } } = req.swagger.params;

  const forceUpdate = req.query.forceupdate || 'false';
  const withNoEvidences = req.query.withNoEvidences || 'false';
  const from = req.query.from;
  const to = req.query.to;
  let lasts = req.query.lasts;

  if (lasts || withNoEvidences) {
    if (!lasts) lasts = 2;

    try {
      // Find the latest 1000 states for the given agreement and guarantee id
      const states = await State.find({ agreementId, id: guaranteeId }).limit(1000).sort({ 'period.from': -1 });

      // Map the states to a more concise format and filter by evidences
      const result = states
        .map(state => ({ records: state.records.reduce((acc, record) => (record.time > acc.time) ? record : acc), period: state.period, id: state.id, agreementId: state.agreementId }))
        .filter(state => state.records.evidences.length > 0 || (withNoEvidences === 'true'));

      // Return the first n items of the filtered result
      res.send(result.slice(0, lasts));
    } catch (err) {
      handleControllerError(res, 'guarantees-controller', 'getGuaranteeById', err.code || 500, 'Error retrieving guarantee ' + guaranteeId, err);
    }
  } else {
    try {
      // Initialize the state manager for the given agreement
      const manager = await stateManager({ id: agreementId });

      const guaranteeDefinition = manager.agreement.terms.guarantees.find(e => guaranteeId === e.id);

      const requestWindow = guaranteeDefinition.of[0].window;
      if (from && to) {
        requestWindow.initial = from;
        requestWindow.end = to;
      }

      // Create an array of query strings for the request period
      const queries = (from && to) ? getPeriods(manager.agreement, requestWindow).map(period => buildGuaranteeQuery(guaranteeId, period.from, period.to)) : [buildGuaranteeQuery(guaranteeId)];

      // Map the queries to Promises and execute them in parallel
      const results = await Promise.all(queries.map(async query => {
        // Validate the query and retrieve the guarantee data from the manager
        const validation = guaranteeQuery(query, guaranteeId, guaranteeDefinition);
        if (!validation.valid) {
          throw new Error('Query validation error');
        } else {
          // Retrieve the guarantee data from the manager
          try {
            const success = await manager.get('guarantees', query, JSON.parse(forceUpdate));
            const result = success.map(element => manager.current(element));
            return result;
          } catch (err) {
            const errorString = `Error retrieving guarantee ${guaranteeId}`;
            return handleControllerError(res, 'guarantees-controller', 'getGuaranteeById', err.code || 500, errorString, err);
          }
        }
      }));
      // Merge the results from all the queries
      const mergedResults = results.reduce((acc, val) => acc.concat(val), []);

      // Send the merged results as the response
      res.json(mergedResults);
    } catch (err) {
      const errorString = `Error while initializing state manager for agreement: ${agreementId}`;
      return handleControllerError(res, 'guarantees-controller', 'getGuaranteeById', err.code || 500, errorString, err);
    }
  }
}

/**
 * This method returns a well-formed query for the stateManager.
 * @param {String} guaranteeId - Id of guarantee which will be calculated
 * @param {ISODateString} from - YYYY-MM-DDTHH:mm:ss.SSSZ
 * @param {ISODateString} to - YYYY-MM-DDTHH:mm:ss.SSSZ
 * @returns {Object} query
 */
function buildGuaranteeQuery(guaranteeId, from, to) {
  const query = { guarantee: guaranteeId };
  if (from) query.period = { from };
  if (to) query.period = { ...query.period, to };
  return query;
}