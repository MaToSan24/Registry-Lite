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
const governify = require('governify-commons');
const logger = governify.getLogger().tag('promise-manager');


import { handlePromiseError } from './errors.js';
import { handleError } from './errors.js';
/**
 * Utils module.
 * @module utils.promises
 * @requires config
 * @requires errors
 * */

module.exports = {
  processSequentialPromises
};

/**
 * Process mode.
 * @param {String} type Type of state to be required (e.g. 'metrics')
 * @param {StateManager} manager StateManager instance
 * @param {Array} queries Array of queries to process
 * */
async function processSequentialPromises(type, manager, queries, forceUpdate) {
  try {
    let result = [];
    for (const query of queries) {
      const states = await manager.get(type, query, forceUpdate);
      for (const state of states) {
        result.push(manager.current(state));
      }
    }
    return result;
  } catch (error) {
    throw handleError('promise', 'processSequentialPromises', 500, 'Error processing sequential promises', error);
  }
}