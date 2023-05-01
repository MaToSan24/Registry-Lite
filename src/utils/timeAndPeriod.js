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
const gPeriods = governify.periods;

/**
 * Utils module.
 * @module utils.promises
 * @requires config
 * */

module.exports = {
  getPeriods,
  getLastPeriod,
  periods
};

/**
 * This method returns a set of periods which are based on a window parameter.
 * @param {AgreementModel} agreement agreement model
 * @param {WindowModel} window window model
 * @return {Set} set of periods
 * @alias module:utils.getPeriods
 * */
function getPeriods (agreement, window = {}) {
  const from = new Date(window.initial || agreement.context.validity.initial);
  const to = new Date();
  const Wfrom = new Date(window.from || from);
  const Wto = window.end ? new Date(window.end) : new Date();
  const dates = gPeriods.getDates(from, to, window.period || 'monthly', Wto, window.rules);
  return gPeriods.getPeriods(dates, agreement.context.validity.timeZone, true, Wfrom, Wto);
}

/**
 * This method returns a set of periods which are based on a window parameter.
 * @param {AgreementModel} agreement agreement model
 * @param {WindowModel} window window model
 * @return {Set} set of periods
 * @alias module:utils.getLastPeriod
 * */
function getLastPeriod (agreement, window = {}) {
  const from = new Date(window.initial || agreement.context.validity.initial);
  const to = new Date();
  const Wto = window.end ? new Date(window.end) : new Date();
  return gPeriods.getLastPeriod(from, to, window.period || 'monthly', Wto, window.rules, agreement.context.validity.timeZone);
}

/**
 * Periods in milliseconds
 * @alias module:utils.periods
 * */
var periods = {
  secondly: 1000,
  minutely: 60000,
  hourly: 3600000,
  daily: 86400000,
  weekly: 604800000,
  monthly: 2628000000,
  quarterly: 7884000000,
  yearly: 31540000000
};