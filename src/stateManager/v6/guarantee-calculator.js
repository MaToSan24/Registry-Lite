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

import { handleError } from '../../utils/errors.js';
import { processParallelPromises } from '../../utils/promise.js';
import { isEqual } from 'lodash'

/**
 * Guarantee calculator module.
 * @module guaranteeCalculator
 * @requires config
 * @see module:calculators
 * */
module.exports = {
  processAllGuarantees,
  processGuarantee
};

/**
 * Process all guarantees.
 * @param {Object} agreement agreement
 * @alias module:guaranteeCalculator.processAllGuarantees
 * */
async function processAllGuarantees(agreement, forceUpdate) {
  try {
    const guarantees = agreement.terms.guarantees.map((guarantee) =>
      processGuarantee(agreement, guarantee.id, true)
    );
    return await processParallelPromises(null, guarantees);
  } catch (err) {
    throw handleError('guarantees', 'processAllGuarantees', 500, 'Error processing guarantees', err);
  }
}

/**
 * Process a single guarantees.
 * @param {Object} agreement agreement
 * @param {Object} guaranteeId guarantee ID
 * @param {Object} manager manager
 * @alias module:guaranteeCalculator.processGuarantee
 * */
async function processGuarantee(manager, query, forceUpdate) {
  const agreement = manager.agreement;
  const guaranteeId = query.guarantee;

  const guarantee = agreement.terms.guarantees.find(guarantee => guarantee.id === guaranteeId);
  if (!guarantee) throw new Error(`Guarantee ${guaranteeId} not found`);

  logger.debug(`Processing scoped guarantee (${guarantee.id}) with query: ${JSON.stringify(query, null, 2)}`);

  const guaranteeValues = await Promise.all(
    guarantee.of
      .filter(ofElement => query.period)
      .map(ofElement => processScopedGuarantee(manager, query, guarantee, ofElement, forceUpdate).then(value => {
        logger.debug('Scoped guarantee has been processed');
        return value;
      }).catch(err => {
        throw new Error(`Error processing scoped guarantee for: ${guarantee.id}. ${err.message}`);
      })
      )
  );

  logger.debug('All scoped guarantees have been processed');
  return { guaranteeId, guaranteeValues: guaranteeValues.flat() };
}

/**
 * Process a scoped guarantee.
 * @function processScopedGuarantee
 * @param {Object} agreement agreement
 * @param {Object} guarantee guarantee
 * @param {Object} ofElement of element
 * @param {Object} manager manager
 * */
async function processScopedGuarantee(manager, query, guarantee, ofElement, forceUpdate) {
  const agreement = manager.agreement;
  const slo = ofElement.objective;
  const penalties = ofElement.penalties;

  // Collect the evidences that will be sent to computer
  const evidences = ofElement.evidences.map(evidence => {
    const evidenceId = Object.keys(evidence)[0];
    const evidenceComputer = evidence[evidenceId].computer;
    if (evidenceComputer) {
      return {
        id: evidenceId,
        computer: evidenceComputer.url.replace(/\/$/, '') + '/api/v' + evidenceComputer.apiVersion + '/' + evidenceComputer.name.replace(/^\//, '')
      };
    }
  });

  // If some scope is not specified, set it with the default values
  const scope = Object.entries(guarantee.scope).reduce((acc, [scope, value]) => {
    if (ofElement.scope && ofElement.scope[scope]) {
      acc[scope] = ofElement.scope[scope];
    } else if (value.default) {
      acc[scope] = value.default;
    }
    return acc;
  }, {});

  /** Get the metrics that need to be calculated from the "with" section of the scoped guarantee
  along with the parameters needed by the manager to calculate the metric state */
  const neededMetrics = ofElement.with
    ? Object.entries(ofElement.with).map(([metric, parameters]) => {
      return {
        metric,
        scope,
        parameters,
        evidences,
        window: {
          ...ofElement.window,
          initial: query.period.from,
          end: query.period && query.period.to,
          timeZone: agreement.context.validity.timeZone,
        },
        period: {
          from: query.period ? query.period.from : '*',
          to: query.period ? query.period.to : '*',
        },
        forceUpdate,
      };
    })
    : [];

  logger.debug(`Obtaining the states of the metrics needed to calculate the scoped guarantee of "${guarantee.id}"...`);

  const metricStates = await Promise.all(
    neededMetrics.map((neededMetric) =>
      manager.get('metrics', neededMetric, neededMetric.forceUpdate).then((scopedMetricStates) => {
        return scopedMetricStates.reduce((acc, metricState) => {
          const ts = {
            scope: metricState.scope,
            period: metricState.period,
          };

          const tsIndex = acc.timedScopes.findIndex((item) => isEqual(item, ts));

          if (tsIndex === -1) {
            acc.timedScopes.push(ts);
            acc.metricStates.push({});
            acc.valueCount++;
            tsIndex = acc.valueCount - 1;
          }

          acc.metricStates[tsIndex][metricState.id] = manager.current(metricState);
          logger.debug('Timed scope array updated for ' + scopedMetricStates[0].id);
          logger.debug('Timed scope: ' + JSON.stringify(acc.timedScopes[tsIndex], null, 2));
          logger.debug('Metric value: ' + JSON.stringify(acc.metricStates[tsIndex], null, 2));

          return acc;
        }, { timedScopes: [], metricStates: [], valueCount: 0 });
      }).catch((err) => {
        return handleError('guarantees', 'processScopedGuarantee', 500, 'Error processing timedScopes metrics for guarantee: ' + guarantee.id, err);
      })
    )
  );

  const guaranteesValues = metricStates.reduce((acc, { timedScopes, metricStates }) => {
    timedScopes.forEach((timedScope, index) => {
      const guaranteeValue = evaluateGuarantee(guarantee, ofElement, timedScope, metricStates[index], slo);
      if (guaranteeValue) {
        acc.push(guaranteeValue);
      }
    });
    return acc;
  }, []);

  logger.debug(`All scoped guarantees of "${guarantee.id}" have been processed`);
  logger.debug('Guarantees values: ' + JSON.stringify(guaranteesValues, null, 2));


  return guaranteesValues;
}

/**
 * Calculate a penalty.
 * @function calculatePenalty
 * @param {Object} agreement agreement
 * @param {Object} guarantee guarantee
 * @param {Object} ofElement of element
 * @param {Object} timedScope timed scope
 * @param {Object} metricStates metric values
 * @param {Object} slo SLO
 * */
function evaluateGuarantee(guarantee, ofElement, timedScope, metricStates, slo) {
  const guaranteeValue = {
    scope: timedScope.scope,
    period: timedScope.period,
    guarantee: guarantee.id,
    evidences: [],
    metrics: {},
  };

  const metricIds = Object.keys(ofElement.with);
  const metricValues = {};

  for (const metricId of metricIds) {
    const metricState = metricStates[metricId];

    if (!metricState) {
      logger.warn(`No state found for metric "${metricId}". Skipping...`);
      continue;
    }

    const value = metricState.value;

    if (value === 'NaN' || value === '') {
      logger.warn(`Unexpected value ("${value}") for metric "${metricId}". Skipping...`);
      continue;
    }

    metricValues[metricId] = value;

    if (metricState.evidences) {
      guaranteeValue.evidences.push(...metricState.evidences);
    } else {
      logger.warn(`Metric "${metricId}" has no evidences.`);
    }
  }

  const isFulfilled = evaluateSLO(slo, metricValues);
  logger.debug(`Guarantee "${guarantee.id}" evaluated to "${isFulfilled ? 'fulfilled' : 'not fulfilled'}".`);

  guaranteeValue.metrics = metricValues;
  guaranteeValue.value = isFulfilled;

  logger.debug(`Guarantee value: ${JSON.stringify(guaranteeValue, null, 2)}`);

  return guaranteeValue;
}

function evaluateSLO(slo, metricValues) {
  // Substitute metric IDs with their values, join them with ';' and append the SLO.
  const metricExpressions = Object.keys(metricValues).map(metricId => `${metricId}=${metricValues[metricId]}`);
  const sloExpression = `${metricExpressions.join(';')};${slo}`;
  let isFulfilled = false;

  logger.debug(`Evaluating SLO expression: ${sloExpression}`);
  
  try {
    // Evaluate the expression and return the result.
    isFulfilled = Boolean(eval(sloExpression));
  } catch (err) {
    logger.error(`Error evaluating SLO expression: ${err}`);
  }

  return isFulfilled;
}