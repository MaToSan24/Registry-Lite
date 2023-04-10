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
  constructor (args) {
    // BUILD scope
    const scope = addComplexParameter(args, 'scope');

    // BUILD parameters
    const parameters = addComplexParameter(args, 'parameters');

    // BUILD window
    const window = addComplexParameter(args, 'window');

    // BUILD period
    const period = addComplexParameter(args, 'period');

    // BUILD period
    const logs = addComplexParameter(args, 'logs');

    if (scope) { this.scope = scope; }
    if (parameters) { this.parameters = parameters; }
    if (window) { this.window = window; }
    if (period) { this.period = period; }
    if (logs) { this.logs = logs; }
  }

  static parseToQueryParams (object, root) {
    let string = '';
    // For each field in object
    for (const f in object) {
      const field = object[f];
      // Check if it is an Object, an Array or a literal value
      if (field instanceof Object && !(field instanceof Array)) {
        // If it is an object do recursive
        string += this.parseToQueryParams(field, (root ? root + '.' : '') + f);
      } else if (field instanceof Array) {
        // If it is an array convert to a list of id
        string += (root ? root + '.' : '') + f + '=' + field.map((e) => {
          if (typeof e === 'string') {
            return e;
          } else if (e.id) {
            return e.id;
          } else {
            return this.parseToQueryParams(e, (root ? root + '.' : '') + f); // FIXME
          }
        }).join(',');
        string += '&';
      } else {
        // If it is a literal convert to "name=value&" format
        string += (root ? root + '.' : '') + f + '=' + field + '&';
      }
    }
    return string;
  }
};

/**
 * @function Function transform from http request to query object
 * @param {Object} args Query of the http request before processing
 * @param {Object} queryObject Object for adding fields
 * @param {String} filter Name for filtering
 */
function addComplexParameter (args, filter) {
  const queryObject = {};
  Object.keys(args).forEach((e) => {
    let name = e.split('.');

    const auxQueryObject = {};
    if (e.indexOf(filter) !== -1 && name[0] === filter) {
      if (name.length > 2) {
        const fieldName = name[1];
        name.splice(0, 1);
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
