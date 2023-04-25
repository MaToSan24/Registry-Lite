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

import Ajv from 'ajv';
import schema from '../schemas/query-schema.json';

/**
 * Metrics module
 * @module metrics
 * @see module:validators
 * */
module.exports = {
  metricQuery,
  guaranteeQuery,
};


/**
 * Validate query for metrics
 * @param {Object} query query
 * @param {Object} metricId ID of the metric
 * @param {Object} metricDefinition Definition of the metric
 * @alias module:validators.metricQuery
 * */
function metricQuery(query, metricId, metricDefinition) {

  // windows are required in metrics
  schema.required = ['scope', 'window'];

  const schemaValidationResults = schemaValidation(schema, query);
  let validation = true; let errors = [];

  // Parameters is not required add empty object if it is null.
  if (!query.parameters) { query.parameters = {}; }

  query.period = query.period || { from: query.window ? query.window.initial : '*', to: query.window ? query.window.end : '*' };

  if (!schemaValidationResults.isValid) {
    validation = validation && false;
    errors = errors.concat(schemaValidationResults.errors.map((e) => { return e.message; }));
  }

  // Parameters are only needed if they are present in the metric definition
  const parametersCount = metricDefinition.parameters ? Object.keys(metricDefinition.parameters).length : 0;
  const inParametersCount = query.parameters ? Object.keys(query.parameters).length : 0;
  if ((parametersCount !== inParametersCount) && parametersCount !== 0) {
    validation = validation && false;
    errors.push('Metric ' + metricId + ' needs parameters: ' + Object.keys(metricDefinition.parameters || []).join(', '));
  }

  // ADD default values for scopes.
  const scopeDef = metricDefinition.scope;
  Object.keys(scopeDef || {}).forEach((s) => {
    if (!query.scope[s]) {
      query.scope[s] = scopeDef[s].default;
    }
  });

  query.metric = metricId;

  delete schema.required;

  return { valid: validation, errors: errors };
}

function metricQuery(query, metricId, metricDefinition) {

  // Windows are required in metrics
  schema.required = ['scope', 'window'];

  const schemaValidationResults = schemaValidation(schema, query);
  const errors = [];

  // Set default values
  query.parameters = query.parameters ?? {};
  query.period = query.period ?? { from: query.window?.initial ?? '*', to: query.window?.end ?? '*' };

  if (!schemaValidationResults.isValid) {
    errors.push(...schemaValidationResults.errors.map((e) => e.message));
  }

  // Parameters are only needed if they are present in the metric definition
  const parameterNames = Object.keys(metricDefinition.parameters ?? {});
  const inParametersCount = Object.keys(query.parameters).length;
  if (parameterNames.length !== inParametersCount && parameterNames.length !== 0) {
    errors.push(`Metric ${metricId} needs parameters: ${parameterNames.join(', ')}`);
  }

  // Add default values for scopes
  const scopeDef = metricDefinition.scope;
  Object.entries(scopeDef ?? {}).forEach(([s, def]) => {
    query.scope[s] = query.scope[s] ?? def.default;
  });

  query.metric = metricId;

  delete schema.required;

  return { valid: errors.length === 0, errors };
}


/**
 * Validate query for guarantee
 * @param {Object} query query
 * @param {Object} guaranteeId ID of the guarantee
 * @param {Object} guaranteeDefinition Definition of the guarantee
 * @alias module:validators.metricQuery
 * */
function guaranteeQuery(query, guaranteeId /*, guaranteeDefinition */) {
  const schema = require('../schemas/query-schema.json');

  const schemaValidationResults = schemaValidation(schema, query);
  let validation = true; let errors = [];

  if (!schemaValidationResults.isValid) {
    validation = validation && false;
    errors = errors.concat(schemaValidationResults.errors.map((e) => { return e.message; }));
  }

  if (query.parameters) {
    validation = validation && false;
    errors.push('Parameters field is not permitted for guarantee queries.');
  }

  if (query.window) {
    validation = validation && false;
    errors.push('Window field is not permitted for guarantee queries.');
  }

  if (query.scope) {
    validation = validation && false;
    errors.push('Scope field is not permitted for guarantee queries.');
  }

  query.guarantee = guaranteeId;

  return {
    valid: validation,
    errors: errors
  };
}

function schemaValidation(schema, data) {
  const ajv = new Ajv();
  const querySchemaValidator = ajv.compile(schema);

  const valid = querySchemaValidator(data);

  return {
    isValid: valid,
    errors: querySchemaValidator.errors
  };
}
