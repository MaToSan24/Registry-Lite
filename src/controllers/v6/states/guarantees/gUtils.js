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
 * Utils that are required in guarantees controller module
 * @module gUtils
 * @requires config
 * @requires bluebird
 * @requires moment
 * */
module.exports = {
  checkQuery: _checkQuery,
  buildGuaranteeQuery: _buildGuaranteeQuery
};

/**
 * This method return a well formed query for stateManager.
 * @param {String} guaranteeId Id of guarantee which will be calculated
 * @param {ISODateString} from YYYY-MM-DDTHH:mm:ss.SSSZ
 * @return {ISODateString} to YYYY-MM-DDTHH:mm:ss.SSSZ
 * */
function _buildGuaranteeQuery (guaranteeId, from, to) {
  const query = {};
  query.guarantee = guaranteeId;
  if (from) {
    query.period = {};
    query.period.from = from;
  }
  if (to) {
    query.period.to = to;
  }
  return query;
}

/**
 * This method return 'true' or 'false' when check if query is complied.
 * @param {StateModel} state state
 * @param {QueryModel} query query
 * @return {Boolean} ret
 * @alias module:gUtils.checkQuery
 * */
function _checkQuery (state, query) {
  let ret = true;
  for (const v in query) {
    if (v !== 'parameters' && v !== 'evidences' && v !== 'logs' && v !== 'window') {
      if (query[v] instanceof Object) {
        ret = ret && _checkQuery(state[v], query[v]);
      } else {
        if ((state[v] !== query[v] && query[v] !== '*') || !state[v]) {
          ret = ret && false;
        }
      }
    }
  }
  return ret;
}
