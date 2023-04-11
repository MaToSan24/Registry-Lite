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

const service = require('../../services/v6/StateService.js');

/**
 * Registry states module.
 * @module StateController
 * @see module:StateService
 * @see module:states
 * @requires StateService
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
 * getAgreementStatesById.
 * @param {Object} req request
 * @param {Object} res response
 * @param {Object} next next function
 * @alias module:StateController.getAgreementStatesById
 * */
function getAgreementStatesById (req, res, next) {
  service.getAgreementStatesById(req.swagger.params, res, next);
}

/**
 * deleteAgreementStatesById.
 * @param {Object} req request
 * @param {Object} res response
 * @param {Object} next next function
 * @alias module:StateController.deleteAgreementStatesById
 * */
function deleteAgreementStatesById (req, res, next) {
  service.deleteAgreementStatesById(req.swagger.params, res, next);
}

/**
 * recalculateAgreementStateById.
 * @param {Object} req request
 * @param {Object} res response
 * @param {Object} next next function
 * @alias module:StateController.recalculateAgreementStateById
 * */
function recalculateAgreementStateById (req, res, next) {
  service.recalculateAgreementStateById(req.swagger.params, res, next);
}

/**
 * getAllMetricsStates.
 * @param {Object} req request
 * @param {Object} res response
 * @param {Object} next next function
 * @alias module:StateController.getAllMetricsStates
 * */
function getAllMetricsStates (req, res, next) {
  service.getAllMetricsStates(req, res, next);
}

/**
 * getMetricStatesById.
 * @param {Object} req request
 * @param {Object} res response
 * @param {Object} next next function
 * @alias module:StateController.getMetricStatesById
 * */
function getMetricStatesById (req, res, next) {
  service.getMetricStatesById(req, res, next);
}

/**
 * deleteAllAgreementsStates.
 * @param {Object} req request
 * @param {Object} res response
 * @param {Object} next next function
 * @alias module:StateController.deleteAllAgreementsStates
 * */
function deleteAllAgreementsStates (req, res, next) {
  service.deleteAllAgreementsStates(req.swagger.params, res, next);
}

/**
 * getAgreementsStatesFiltered.
 * @param {Object} req request
 * @param {Object} res response
 * @param {Object} next next function
 * @alias module:StateController.getAgreementsStatesFiltered
 * */
function getAgreementsStatesFiltered (req, res, next) {
  service.getAgreementsStatesFiltered(req, res, next);
}
