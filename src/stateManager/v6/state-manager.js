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

const db = require('../../database');
const Promise = require('bluebird');

import { processAgreement } from '../../stateManager/v6/agreement-calculator.js';
import { processAllGuarantees } from '../../stateManager/v6/guarantee-calculator.js';
import { processAllMetrics } from '../../stateManager/v6/metric-calculator.js';
import { ErrorModel, handlePromiseError } from '../../utils/errors.js';

/**
 * State manager module.
 * @module stateManager
 * @requires config
 * @requires database
 * @requires errors
 * @requires bluebird
 * @requires requestretry
 * */
module.exports = initialize;

/**
 * Initialize the StateManager for an agreement.
 * @param {String} _agreement agreement ID
 * @return {Promise} Promise that will return a StateManager object
 * @alias module:stateManager.initialize
 * */
function initialize(_agreement) {
  logger.debug('(initialize) Initializing state with agreement ID = ' + _agreement.id);
  return new Promise(function (resolve, reject) {
    const AgreementModel = db.models.AgreementModel;
    logger.debug('Searching agreement with agreementID = ' + _agreement.id);
    // Executes a mongodb query to search Agreement file with id = _agreement
    AgreementModel.findOne({
      id: _agreement.id
    }, function (err, ag) {
      if (err) {
        // something fail on mongodb query and error is returned
        logger.error(err.toString());
        return reject(new ErrorModel(500, err));
      } else {
        if (!ag) {
          // Not found agreement with id = _agreement
          return reject(new ErrorModel(404, 'There is no agreement with id: ' + _agreement.id));
        }
        logger.debug('StateManager for agreementID = ' + _agreement.id + ' initialized');
        // Building stateManager object with agreement definitions and stateManager method
        // get ==> gets one or more states
        // put ==> save an scoped state
        // update ==> calculates one or more states and save them
        // current ==> do a map over state an returns the current record for this state.
        const stateManager = {
          agreement: ag,
          get,
          put,
          update,
          current
        };
        return resolve(stateManager);
      }
    });
  });
}

/**
 * Gets one or more states by an specific query.
 * @function get
 * @param {String} stateType enum: {guarantees, agreement, metrics}
 * @param {StateManagerQuery} query query will be matched with an state.
 * @return {Promise} Promise that will return an array of state objects
 * */
function get(stateType, query, forceUpdate) {
  const stateManager = this;
  logger.debug('(GET) Retrieving state of ' + stateType + ' - ForceUpdate: ' + forceUpdate);
  return new Promise(function (resolve, reject) {
    logger.debug('Getting ' + stateType + ' state for query =  ' + JSON.stringify(query));
    const StateModel = db.models.StateModel;
    if (!query) {
      query = {};
    }
    // Executes a mongodb query to search States file that match with query
    // projectionBuilder(...) builds a mongodb query from StateManagerQuery
    // refineQuery(...) ensures that the query is well formed, chooses and renames fields to make a well formed query.
    StateModel.find(projectionBuilder(stateType, refineQuery(stateManager.agreement.id, stateType, query)), function (err, result) {
      if (err) {
        // Something failed on mongodb query and error is returned
        logger.debug(JSON.stringify(err));
        return reject(new ErrorModel(500, 'Error while retrieving %s states: %s', stateType, err.toString()));
      }
      // If there are states in mongodb match the query, checks if it's updated and returns.
      if (result.length > 0) {
        logger.debug('There are ' + stateType + ' state for query =  ' + JSON.stringify(query) + ' in DB');
        const states = result;

        logger.debug('Checking if ' + stateType + ' is updated...');
        logger.debug("Updated: " + (data.isUpdated ? 'YES' : 'NO') + "[forceUpdate: " + forceUpdate + "]");
        // States are updated, returns.
        logger.debug('Refreshing states of ' + stateType);
        stateManager.update(stateType, query, 0, forceUpdate).then(function (states) { // Change 0 with (data.logState) in case of using DB system.
          return resolve(states);
        }, function (err) {
          return reject(err);
        });
      } else {
        logger.debug('There are not ' + stateType + ' state for query =  ' + JSON.stringify(query) + ' in DB');
        logger.debug('Adding states of ' + stateType);
        stateManager.update(stateType, query, 0, forceUpdate).then(function (states) {
          return resolve(states);
        }).catch(function (err) {
          const errorString = 'Error getting metrics';
          return handlePromiseError(reject, 'state-manager', '_get', 500, errorString, err);
        });
      }
    });
  });
}

/**
 * Add states with an specific query.
 * @function put
 * @param {String} stateType enum: {guarantees, agreement, metrics}
 * @param {StateManagerQuery} query query will be matched with an state.
 * @param {Object} value value
 * @param {Object} metadata {logsState, evidences, parameters}.
 * @return {Promise} Promise that will return an array of state objects
 * */
function put(stateType, query, value, metadata) {
  const stateManager = this;
  logger.debug('(PUT) Saving state of ' + stateType);
  return new Promise(function (resolve, reject) {
    const StateModel = db.models.StateModel;

    logger.debug('AGREEMENT: ' + stateManager.agreement.id);
    const dbQuery = projectionBuilder(stateType, refineQuery(stateManager.agreement.id, stateType, query));
    logger.debug('Updating ' + stateType + ' state... with refinedQuery = ' + JSON.stringify(dbQuery, null, 2));

    StateModel.update(dbQuery, {
      $push: {
        records: new Record(value, metadata)
      }
    }, function (err, result) {
      if (err) {
        logger.debug('Error, Is not possible to update state with this query = ' + JSON.stringify(query));
        return reject(new ErrorModel(500, err));
      } else {
        logger.debug('NMODIFIED record:  ' + JSON.stringify(result));

        let stateSignature = 'StateSignature (' + result.nModified + ') ' + '[';
        for (const v in dbQuery) {
          stateSignature += dbQuery[v];
        }
        stateSignature += ']';
        logger.debug(stateSignature);

        // Check if there already is an state
        if (result.nModified === 0) {
          // There is no state for Guarantee / Metric , ....
          logger.debug('Creating new ' + stateType + ' state with the record...');

          const newState = new State(value, refineQuery(stateManager.agreement.id, stateType, query), metadata);
          const stateModel = new StateModel(newState);

          stateModel.save(newState, function (err) {
            if (err) {
              logger.error(err.toString());
              return reject(new ErrorModel(500, err));
            } else {
              logger.debug('Inserted new Record in the new ' + stateType + ' state.');
              StateModel.find(projectionBuilder(stateType, refineQuery(stateManager.agreement.id, stateType, query)), function (err, result) {
                if (err) {
                  logger.error(err.toString());
                  return reject(new ErrorModel(500, err));
                }
                return resolve(result);
                //   }
              });
            }
          });
        } else {
          // There is some state for Guarantee / Metric , ....
          // Lets add a new Record.
          logger.debug('Inserted new Record of ' + stateType + ' state.');
          StateModel.find(projectionBuilder(stateType, refineQuery(stateManager.agreement.id, stateType, query)), function (err, result) {
            if (err) {
              logger.error(err.toString());
              return reject(new ErrorModel(500, err));
            }
            return resolve(result);
          });
        }
      }
    });
  });
}

/**
 * Modify states with an specific query.
 * @function update
 * @param {String} stateType enum: {guarantees, agreement, metrics}
 * @param {StateManagerQuery} query query will be matched with an state.
 * @param {Object} logsState logsState
 * @return {Promise} Promise that will return an array of state objects
 * */
function update(stateType, query, logsState, forceUpdate) {
  const stateManager = this;
  logger.debug('(UPDATE) Updating state of ' + stateType);
  return new Promise(function (resolve, reject) {
    switch (stateType) {
      case 'agreement':
        processAgreement(stateManager)
          .then(function (states) {
            return resolve(states);
          }, function (err) {
            logger.error(err.toString());
            return reject(new ErrorModel(500, err));
          });
        break;
      case 'guarantees':
        const guaranteeDefinition = stateManager.agreement.terms.guarantees.find((e) => {
          return query.guarantee === e.id;
        });
        processAllGuarantees(stateManager, query, forceUpdate)
          .then(function (guaranteeStates) {
            logger.debug('Guarantee states for ' + guaranteeStates.guaranteeId + ' have been calculated (' + guaranteeStates.guaranteeValues.length + ') ');
            logger.debug('Guarantee states: ' + JSON.stringify(guaranteeStates, null, 2));
            const processGuarantees = [];
            guaranteeStates.guaranteeValues.forEach(function (guaranteeState) {
              logger.debug('Guarantee state: ' + JSON.stringify(guaranteeState, null, 2));
              processGuarantees.push(stateManager.put(stateType, {
                guarantee: query.guarantee,
                period: guaranteeState.period,
                scope: guaranteeState.scope
              }, guaranteeState.value, {
                metrics: guaranteeState.metrics,
                evidences: guaranteeState.evidences
              }));
            });
            logger.debug('Created parameters array for saving states of guarantee of length ' + processGuarantees.length);
            logger.debug('Persisting guarantee states...');
            Promise.all(processGuarantees).then(function (guarantees) {
              logger.debug('All guarantee states have been persisted');
              const result = [];
              for (const a in guarantees) {
                result.push(guarantees[a][0]);
              }
              return resolve(result);
            });
          }).catch(function (err) {
            logger.error(err);
            const errorString = 'Error processing guarantees';
            return handlePromiseError(reject, 'state-manager', '_update', 500, errorString, err);
          });
        // }
        break;
      case 'metrics':
        processAllMetrics(stateManager.agreement, query.metric, query)
          .then(function (metricStates) {
            logger.debug('Metric states for ' + metricStates.metricId + ' have been calculated (' + metricStates.metricValues.length + ') ');
            const processMetrics = [];
            metricStates.metricValues.forEach(function (metricValue) {
              processMetrics.push(
                stateManager.put(stateType, {
                  metric: query.metric,
                  scope: metricValue.scope,
                  period: metricValue.period,
                  window: query.window
                }, metricValue.value, {
                  evidences: metricValue.evidences,
                  parameters: metricValue.parameters
                }));
            });
            logger.debug('Created parameters array for saving states of metric of length ' + processMetrics.length);
            logger.debug('Persisting metric states...');
            return Promise.all(processMetrics).then(function (metrics) {
              logger.debug('All metric states have been persisted');
              const result = [];
              for (const a in metrics) {
                result.push(metrics[a][0]);
              }
              return resolve(result);
            });
          }).catch(function (err) {
            const errorString = 'Error processing metrics';
            return handlePromiseError(reject, 'state-manager', '_update', 500, errorString, err);
          });
        break;
      default:
        return reject(new ErrorModel(500, 'There are not method implemented to calculate ' + stateType + ' state'));
    }
  });
}

/**
 * State.
 * @function State
 * @param {Object} value value
 * @param {String} query query will be matched with an state.
 * @param {Object} metadata {logsState, evidences, parameters}
 * */
function State(value, query, metadata) {
  for (const v in query) {
    this[v] = query[v];
  }
  this.records = [];
  this.records.push(new Record(value, metadata));
}

/**
 * Record.
 * @function Record
 * @param {Object} value value
 * @param {Object} metadata {logsState, evidences, parameters}
 * */
function Record(value, metadata) {
  this.value = value;
  this.time = new Date().toISOString();
  if (metadata) {
    for (const v in metadata) {
      this[v] = metadata[v];
    }
  }
}

/**
 * current.
 * @function _current
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
 * @function refineQuery
 * @param {String} agreementId agreementId
 * @param {String} stateType enum: {guarantees, agreement, metrics}
 * @param {String} query query will be matched with an state.
 * @return {object} refined query
 * */
function refineQuery(agreementId, stateType, query) {
  const idProperties = { metrics: 'metric', guarantees: 'guarantee' };
  const refinedQuery = { stateType, agreementId, ...query, id: query[idProperties[stateType]] };
  return refinedQuery;
}

/**
 * Refine the query for a search in database.
 * @function projectionBuilder
 * @param {String} stateType enum: {guarantees,  agreement, metrics}
 * @param {String} query query will be matched with an state.
 * @return {String} mongo projection
 * */
function projectionBuilder(stateType, query) {
  const singular = { guarantees: 'guarantee', metrics: 'metric', agreement: 'agreement' };
  const singularStateType = singular[stateType];

  if (!singularStateType) return logger.error(`projectionBuilder error: stateType '${stateType}' is not expected`);

  let projection = {};
  for (const [propName, propValue] of Object.entries(query)) {
    if (typeof propValue === 'object') {
      for (const [subPropName, subPropValue] of Object.entries(propValue)) {
        if (subPropValue !== '*') {
          const key = `${propName}.${subPropName}`;
          projection[key] = subPropValue;
        }
      }
    } else if (propValue !== '*') {
      projection[propName] = propValue;
    }
  }

  logger.debug(`Mongo projection: ${JSON.stringify(projection, null, 2)}`);
  return projection;
}