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
const Promise = require('bluebird');
const JSONStream = require('JSONStream');
const moment = require('moment');

const governify = require('governify-commons');
const config = governify.configurator.getConfig('main');
const logger = governify.getLogger().tag('guarantees');
const ErrorModel = require('../../../../errors').errorModel;

const stateManager = require('../../stateManager/v6/state-manager');
const db = require('../../database');

const utils = require('../../utils');

const Query = utils.Query;
const controllerErrorHandler = utils.errors.controllerErrorHandler;

import State from '../../models/State.js';

/**
 * Guarantees module
 * @module guarantees
 * @see module:states
 * @requires config
 * @requires bluebird
 * @requires JSONStream
 * @requires stream
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
      const validation = utils.validators.guaranteeQuery(queryM, guarantee.id, guarantee);

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

    const result = await utils.promise.processSequentialPromises('guarantees', manager, guaranteesQueries, null, null, false, true);
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

    const result = config.streaming ? (res.setHeader('content-type', 'application/json; charset=utf-8'), utils.stream.createReadable().pipe(JSONStream.stringify()).pipe(res)) : [];

    const manager = await stateManager({ id: agreementId });
    logger.info('Getting state of guarantees...');

    if (config.parallelProcess.guarantees) {
      logger.info('### Process mode = PARALLEL ###');

      const promises = getGuaranteesPromises(manager, req.query, validationErrors);
      const results = await Promise.all(promises.filter(Boolean));

      if (validationErrors.length === 0) {
        utils.promise.processParallelPromises(manager, results, result, res, config.streaming);
      } else {
        logger.error('Error while getting guarantees (PARALLEL): ' + JSON.stringify(validationErrors));
        res.status(400).json(new ErrorModel(400, validationErrors));
      }
    } else {
      logger.info('### Process mode = SEQUENTIAL ###');
      const queries = getGuaranteesQueries(manager, req.query, validationErrors, from, to, lastPeriod, newPeriodsFromGuarantees);

      if (validationErrors.length > 0) {
        logger.error('Error while getting guarantees (SEQUENTIAL): ' + JSON.stringify(validationErrors));
        res.status(400).json(new ErrorModel(400, validationErrors));
      } else {
        logger.info('Getting guarantees...');
        utils.promise.processSequentialPromises('guarantees', manager, queries, result, res, config.streaming, forceUpdate === 'true');
      }
    }
  } catch (err) {
    logger.error(`Error while processing guarantees: ${err}`);
    res.status(500).json(new ErrorModel(500, err.message));
  }
}

function getGuaranteesPromises(manager, query, validationErrors) {
  return manager.agreement.terms.guarantees.map(async (guarantee) => {
    const queryObject = new Query(query);
    const validation = utils.validators.guaranteeQuery(queryObject, guarantee.id, guarantee);
    
    if (!validation.valid) {
      validation.guarantee = guarantee.id;
      validationErrors.push(validation);
      logger.error('Error while getting guarantees: ' + JSON.stringify(validationErrors));
      return null;
    }

    return manager.get('guarantees', queryObject, query.forceUpdate === 'true');
  });
}

function getGuaranteesQueries(manager, query, validationErrors, from, to, lastPeriod, newPeriodsFromGuarantees) {
  return manager.agreement.terms.guarantees.reduce((queries, guarantee) => {
    const guaranteeDefinition = manager.agreement.terms.guarantees.find(e => e.id === guarantee.id);
    const requestWindow = guaranteeDefinition.of[0].window;

    let allQueries = [];
    if (from && to) {
      requestWindow.from = from;
      requestWindow.end = to;
      const periods = newPeriodsFromGuarantees ? utils.time.getPeriods(manager.agreement, requestWindow) : [{ from: new Date(from).toISOString(), to: new Date(to).toISOString() }];
      allQueries = periods.map(period => buildGuaranteeQuery(guarantee.id, period.from, period.to));
    } else if (lastPeriod) {
      const period = utils.time.getLastPeriod(manager.agreement, requestWindow);
      allQueries.push(buildGuaranteeQuery(guarantee.id, period.from, period.to));
    } else {
      allQueries.push(guarantee.id);
    }

    allQueries.forEach(query => {
      const validation = utils.validators.guaranteeQuery(query, guarantee.id);
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
function getGuaranteeById(req, res) {
  logger.info('New request to GET guarantee');
  const args = req.swagger.params;
  const agreementId = args.agreement.value;
  const query = new Query(req.query);
  const guaranteeId = args.guarantee.value;
  const forceUpdate = req.query.forceupdate ? req.query.forceupdate : 'false';
  const from = req.query.from;
  const to = req.query.to;
  const withNoEvidences = req.query.withNoEvidences ? req.query.withNoEvidences : 'false';
  let lasts = req.query.lasts;

  let ret;
  if (config.streaming) {
    logger.info('### Streaming mode ###');
    res.setHeader('content-type', 'application/json; charset=utf-8');
    ret = utils.stream.createReadable();
    ret.pipe(JSONStream.stringify()).pipe(res);
  } else {
    logger.info('### NO Streaming mode ###');
  }

  if (lasts || withNoEvidences) {
    if (!lasts) {
      lasts = 2;
    }

    let dbresult;
    State.find({ agreementId, id: guaranteeId }).limit(1000).sort({ 'period.from': -1 })
      .exec((err, states) => {
        if (err) {
          res.status(500).json(new ErrorModel(500, err));
        } else {
          dbresult = states;
          dbresult = dbresult.map(state => {
            let records = state.records;
            records = records.reduce((acc, record) => {
              if (record.time > acc.time) acc = record;
              return acc;
            });
            return { records, period: state.period, id: state.id, agreementId: state.agreementId };
          });
          dbresult = dbresult.filter(state => state.records.evidences.length > 0 || (withNoEvidences === 'true'));
          res.send(dbresult.slice(0, lasts));
        }
      });
  } else {
    stateManager({
      id: agreementId
    }).then(function (manager) {
      const guaranteeDefinition = manager.agreement.terms.guarantees.find((e) => {
        return guaranteeId === e.id;
      });
      const requestWindow = guaranteeDefinition.of[0].window; // Create the window for the current request
      logger.info('Iniciating guarantee (' + guaranteeId + ') calculation with window' + JSON.stringify(requestWindow));
      let periods;
      let allQueries = [];
      if (from && to) {
        requestWindow.initial = from;
        requestWindow.end = to;
        periods = utils.time.getPeriods(manager.agreement, requestWindow);
        // Create query for every period
        allQueries = periods.map(function (period) {
          return buildGuaranteeQuery(guaranteeId, period.from, period.to);
        });
      } else {
        allQueries.push(buildGuaranteeQuery(guaranteeId));
      }
      const results = [];
      logger.info('Processing ' + allQueries.length + ' queries for the request');
      Promise.each(allQueries, function (queryInd) {
        const validation = utils.validators.guaranteeQuery(queryInd, guaranteeId, guaranteeDefinition);
        if (!validation.valid) {
          const errorString = 'Query validation error';
          return controllerErrorHandler(res, 'guarantees-controller', 'getGuaranteeById', 400, errorString);
        } else {
          return manager.get('guarantees', queryInd, JSON.parse(forceUpdate)).then(function (success) {
            if (config.streaming) {
              success.forEach(function (element) {
                ret.push(manager.current(element));
              });
            } else {
              const result = success.map(function (element) {
                return manager.current(element);
              });

              results.push(result);
            }
          }, function (err) {
            const errorString = 'Error retrieving guarantee ' + guaranteeId;
            return controllerErrorHandler(res, 'guarantees-controller', 'getGuaranteeById', err.code || 500, errorString, err);
          });
        }
      }).then(function () {
        if (config.streaming) {
          ret.push(null);
        } else {
          res.json(results);
        }
      });
    }, function (err) {
      const errorString = 'Error while initializing state manager for agreement: ' + agreementId;
      return controllerErrorHandler(res, 'guarantees-controller', 'getGuaranteeById', err.code || 500, errorString, err);
    });
  }
}

async function getGuaranteeById(req, res) {
  try {
    const args = req.swagger.params;
    const agreementId = args.agreement.value;
    const guaranteeId = args.guarantee.value;
    const queryOptions = {
      forceUpdate: req.query.forceupdate ? req.query.forceupdate : 'false',
      from: req.query.from,
      to: req.query.to,
      withNoEvidences: req.query.withNoEvidences ? req.query.withNoEvidences : 'false',
      lasts: req.query.lasts,
    };

    logger.info('New request to GET guarantee');
    const agreement = await getAgreement(agreementId);
    const guarantee = agreement.terms.guarantees.find((e) => e.id === guaranteeId);
    
    if (config.streaming) {
      logger.info('### Streaming mode ###');
      res.setHeader('content-type', 'application/json; charset=utf-8');
      const resultStream = await getGuaranteeStream(agreement, guarantee, queryOptions);
      resultStream.pipe(JSONStream.stringify()).pipe(res);
    } else {
      logger.info('### NO Streaming mode ###');
      const result = await getGuarantee(agreement, guarantee, queryOptions);
      res.json(result);
    }
  } catch (error) {
    const errorString = error.message || 'Internal Server Error';
    const statusCode = error.statusCode || 500;
    return controllerErrorHandler(res, 'guarantees-controller', 'getGuaranteeById', statusCode, errorString, error);
  }
}

async function getGuaranteeStream(agreement, guarantee, queryOptions) {
  const stateManager = await getStateManager(agreement.id);
  const queryGenerator = getQueryGenerator(guarantee, queryOptions, stateManager.agreement);
  const validationErrors = validateQueries(queryGenerator, guarantee);
  if (validationErrors.length) {
    throw { message: 'Query validation error', statusCode: 400 };
  }
  return utils.stream.createReadable(async (push) => {
    for await (const query of queryGenerator) {
      const result = await stateManager.get('guarantees', query, JSON.parse(queryOptions.forceUpdate));
      result.forEach((element) => push(stateManager.current(element)));
    }
    push(null);
  });
}

async function getGuarantee(agreement, guarantee, queryOptions) {
  const stateManager = await getStateManager(agreement.id);
  const queryGenerator = getQueryGenerator(guarantee, queryOptions, stateManager.agreement);
  const validationErrors = validateQueries(queryGenerator, guarantee);
  if (validationErrors.length) {
    throw { message: 'Query validation error', statusCode: 400 };
  }
  const result = [];
  for await (const query of queryGenerator) {
    const queryResult = await stateManager.get('guarantees', query, JSON.parse(queryOptions.forceUpdate));
    queryResult.forEach((element) => result.push(stateManager.current(element)));
  }
  if (queryOptions.withNoEvidences === 'true') {
    result.filter((state) => state.records.evidences.length === 0);
  }
  if (queryOptions.lasts) {
    result.slice(0, queryOptions.lasts);
  }
  return result;
}

function getQueryGenerator(guarantee, queryOptions, agreement) {
  const requestWindow = guarantee.of[0].window;

  const periods = utils.time.getPeriods(agreement, requestWindow, queryOptions.from, queryOptions.to);
  const promises = periods.map((period) => {
    return buildGuaranteeQuery(guarantee.id, period.from, period.to);
  });

  return Promise.all(promises);
}

async function getAgreement(agreementId) {
  try {
    const manager = await stateManager({ id: agreementId });
    const agreement = manager.agreement;
    return agreement;
  } catch (err) {
    const errorString = 'Error while initializing state manager for agreement: ' + agreementId;
    throw new ErrorModel(err.code || 500, errorString, err);
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