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

const stateManager = require('../../stateManager/v6/state-manager.js');
const JSONStream = require('JSONStream');

import Agreement from '../../models/Agreement.js';
import State from '../../models/State.js';
import { metricQuery } from '../../utils/validators.js';
import { processAgreement } from '../../stateManager/v6/agreement-calculator.js';

/**
 * Agreement state module.
 * @module agreementsState
 * @see module:states
 * @requires config
 * @requires stateManager
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
async function getAgreementStatesById(args, res) {
  try {
    logger.info('New request to GET agreements (states/agreements/agreements.js)');
    const agreementId = args.agreement.value;

    const manager = await stateManager({ id: agreementId });
    const agreement = await manager.get(agreementId);

    logger.info('Agreement state for agreement ' + agreementId + ' retrieved');
    res.send(agreement);
  } catch (err) {
    logger.error(err.message.toString());
    res.status(err.code).send(err);
  }
}

/**
 * Delete an agreement state by agreement ID.
 * @param {Object} args {agreement: String, from: String, to: String}
 * @param {Object} res response
 * @param {Object} next next function
 * @alias module:agreements.deleteAgreementStatesById
 * */
async function deleteAgreementStatesById(args, res) {
  try {
    logger.info('New request to DELETE agreement state for agreement ' + agreementId);
    const agreementId = args.agreement.value;

    const deletedState = await State.deleteMany({ agreementId });

    if (!deletedState || deletedState.deletedCount === 0) {
      logger.warn(`Agreement state with id ${agreementId} not found.`);
      return res.sendStatus(404);
    }

    logger.info(`Deleted state for agreement ${agreementId}`);
    res.sendStatus(200);
  } catch (err) {
    logger.error(`Error deleting state for agreement ${agreementId}: ${err}`);
    res.status(500).send(err);
  }
}

/**
 * Delete all agreement states
 * @param {Object} args {agreement: String}
 * @param {Object} res response
 * @param {Object} next next function
 * @alias module:agreements.deleteAllAgreementsStates
 * */
async function deleteAllAgreementsStates(args, res) {
  logger.info('New request to DELETE all agreement states');
  try {
    await State.deleteMany({});
    res.sendStatus(200);
    logger.info('Deleted state for all agreements');
  } catch (err) {
    logger.warn(`Can't delete state for all agreements: ${err}`);
    res.status(500).send(err);
  }
}

/**
 * GET all the states of all the metrics
 * @param {Object} req request
 * @param {Object} res response
 * @param {Object} next next function
 * @alias module:metrics.metricsPOST
 * */
async function getAllMetricsStates(req, res) {
  try {
    const args = req.swagger.params;
    const agreementId = args.agreement.value;
    const result = [];
    const validationErrors = [];

    logger.info('New request to GET metrics of agreement: ' + agreementId);
    const manager = await stateManager({ id: agreementId });

    logger.info('Preparing requests to /states/' + agreementId + '/metrics/{metricId} : ');
    for (const [metricId, metricTerms] of Object.entries(manager.agreement.terms.metrics)) {
      const query = new Query(req.query);
      const validation = metricQuery(query, metricId, metricTerms);

      if (!validation.valid) {
        validation.metric = metricId;
        validationErrors.push(validation);
        logger.warn('Validation error: ' + JSON.stringify(validation));
      } else {
        logger.info('Request to /states/' + agreementId + '/metrics/' + metricId + ' : ' + JSON.stringify(query));
        result.push(await manager.get('metrics', query));
      }
    }

    if (validationErrors.length === 0) {
      logger.info('Metrics of agreement ' + agreementId + ' retrieved');
      res.status(200).json(result);
    } else {
      res.status(400).json(new ErrorModel(400, validationErrors));
    }
  } catch (err) {
    logger.error(err.message.toString());
    res.status(500).json(new ErrorModel(500, err));
  }
}

/**
 * GET all the states of a metric by a metric ID.
 * @param {Object} args {agreement: String, metric: String}
 * @param {Object} res response
 * @param {Object} next next function
 * @alias module:metrics.modifyMetricById
 * */
async function getMetricStatesById(req, res) {
  try {
    const { agreement: agreementId, metric: metricId } = req.swagger.params;
    const query = new Query(req.query);
    let result = [];

    const manager = await stateManager({ id: agreementId });
    const validation = metricQuery(query, metricId, manager.agreement.terms.metrics[metricId]);

    if (!validation.valid) {
      logger.warn('Validation error: ' + JSON.stringify(validation));
      res.status(400).json(new ErrorModel(400, validation));
      return;
    }

    const data = await manager.get('metrics', query);
    if (config.streaming) { // Creo que esta comprobación está al revés.
      result = data.map((element) => manager.current(element));
    } else {
      data.forEach((element) => result.push(manager.current(element)));
      result.push(null);
    }
    logger.info('Metric states of agreement ' + agreementId + ' retrieved');
    res.json(result);
  } catch (err) {
    const errorString = `Error retrieving state values of metric: ${metricId}`;
    handleControllerError(res, 'metrics-controller', 'getMetricStatesById', 500, errorString, err);
  }
}

/**
 * States filter
 * @param {Object} req {agreement: String}
 * @param {Object} res response
 * @param {Object} next next function
 * @alias module:agreements.getAgreementsStatesFiltered
 * */
async function getAgreementsStatesFiltered(req, res) {
  try {
    logger.info(`New request to GET filtered agreements states (states/agreements/agreements.js) with params: ${JSON.stringify(req.query)}`);

    const agreementId = req.swagger.params.agreement.value;
    const indicator = req.query.indicator;
    const type = req.query.type;
    const from = req.query.from || req.query.at;
    const to = req.query.to;
    const scopeQuery = getScopeQuery(req.query);
    const andQuery = { agreementId: agreementId, id: indicator, stateType: type, 'period.from': from };

    if (to) Object.assign(andQuery, { 'period.to': to });
    Object.assign(andQuery, scopeQuery);

    const pipeline = [
      { $match: { $and: [andQuery] } },
      { $unwind: '$records' },
      { $group: { _id: { $concat: ['$records.evidences', '_$scope'] }, evidences: { $push: '$records.evidences' } } },
      { $group: { _id: '$_id.evidences', scope: { $addToSet: '$_id.scope' } } },
      { $project: { _id: 0, evidences: '$_id', scope: '$scope' } }
    ];

    const cursor = State.aggregate(pipeline).allowDiskUse(true).cursor();

    res.setHeader('content-type', 'application/json; charset=utf-8');
    cursor.pipe(JSONStream.stringify()).pipe(res); // Modificar función para que no use JSONStream
  } catch (err) {
    logger.error(`Error retrieving filtered state values of agreements: ${err}`);
    handleControllerError(res, 'agreements-controller', 'getAgreementsStatesFiltered', 500, `Error retrieving filtered state values of agreements`, err);
  }
}

function getScopeQuery(query) {
  const scopeQuery = {};

  for (const property in query) {
    if (property.startsWith('scope.')) {
      const value = query[property];

      if (value === '*') {
        scopeQuery[`records.${property}`] = { $exists: true };
      } else if (isNaN(value)) {
        scopeQuery[`records.${property}`] = value;
      } else {
        scopeQuery[`records.${property}`] = parseInt(value);
      }
    }
  }

  return scopeQuery;
}

/**
 * Reload an agreement state by agreement ID.
 * @param {Object} args {agreement: String, from: String, to: String}
 * @param {Object} res response
 * @param {Object} next next function
 * @alias module:agreements.recalculateAgreementStateById
 * */
async function recalculateAgreementStateById(req, res, next) {
  try {
    const agreementId = req.params.agreementId;
    const parameters = req.body;

    logger.info(`New request to reload state of agreement ${agreementId}`);
    await State.deleteMany({ agreementId });
    logger.info(`Deleted state for agreement ${agreementId}`);

    const agreement = await Agreement.findOne({ id: agreementId });
    if (!agreement) return res.status(404).send(`Agreement with ID ${agreementId} not found`);

    const manager = await stateManager({ id: agreementId });
    logger.info('Calculating agreement state...');
    await processAgreement(manager, parameters.requestedState);

    logger.info('Agreement state recalculated successfully');
    res.send(`Agreement state for ID ${agreementId} has been reloaded successfully`);
  } catch (error) {
    logger.error(`Error reloading agreement state: ${error}`);
    next(error);
  }
}