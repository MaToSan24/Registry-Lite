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

/**
 * @class Query
 *
 */
module.exports = class Query {
  constructor(args) {
    // BUILD scope
    this.scope = addComplexParameter(args, 'scope');

    // BUILD parameters
    this.parameters = addComplexParameter(args, 'parameters');

    // BUILD window
    this.window = addComplexParameter(args, 'window');

    // BUILD period
    this.period = addComplexParameter(args, 'period');

    // BUILD logs
    this.logs = addComplexParameter(args, 'logs');
  }

  /**
   * Converts an object to a string with query parameters
   * @static
   * @param {Object} object - The object to convert to query parameters.
   * @param {string} root - The root of the object.
   * @returns {string} The query parameters string.
   */
  static parseToQueryParams(object, root = '') {
    let string = '';
    for (const [key, value] of Object.entries(object)) {
      // Check if it is an Object or a literal value
      if (typeof value === 'object' && !Array.isArray(value)) {
        string += this.parseToQueryParams(value, root + `${key}.`);
      } else if (Array.isArray(value)) {
        // If it is an array convert to a list of id
        string += root + key + '=' + value.map(e => typeof e === 'string' ? e : e.id || this.parseToQueryParams(e, root + `${key}.`)).join(',') + '&';
      } else {
        // If it is a literal convert to "name=value&" format
        string += root + key + '=' + value + '&';
      }
    }
    return string;
  }
};

/**
 * Function to transform from HTTP request to query object.
 * @param {Object} args Query of the HTTP request before processing
 * @param {String} filter Name for filtering
 * @returns {Object} The query object.
 */
function addComplexParameter(args, filter) {
  let queryObject = {};

  Object.keys(args).forEach((e) => {
    let name = e.split('.');

    if (e.indexOf(filter) !== -1 && name[0] === filter) {
      if (name.length > 2) {
        const fieldName = name[1];
        name.splice(0, 1);
        const auxQueryObject = {};
        auxQueryObject[name.join('.')] = args[e];
        queryObject[fieldName] = addComplexParameter(auxQueryObject, name[0]);
      } else {
        name = name[1];
        queryObject[name] = args[e];
      }
    }
  });

  return Object.keys(queryObject).length > 0 ? queryObject : null;
}