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

const states = require('./states/states.js');

/**
 * Registry states module.
 * @module StateController
 * @see module:StateService
 * @see module:states
 * @requires StateService
 * */
module.exports = {
  // Agreement
  getAgreementById,
  statesAgreementRELOAD,
  deleteAgreementById,
  statesDELETE,
  // Guarantees
  getAllGuarantees,
  statesAgreementGuaranteesGuaranteeGET,
  // Metrics
  statesAgreementgetAllMetricsStates,
  statesAgreementMetricsMetricGET,
  statesAgreementMetricsMetricIncreasePOST,
  statesAgreementMetricsMetricPOST,

  statesFilter
};

/**
 * getAgreementById.
 * @param {Object} req request
 * @param {Object} res response
 * @param {Object} next next function
 * @alias module:StateController.getAgreementById
 * */
function getAgreementById (req, res, next) {
  states.agreements.getAgreementById(req.swagger.params, res, next);
}

/**
 * deleteAgreementById.
 * @param {Object} req request
 * @param {Object} res response
 * @param {Object} next next function
 * @alias module:StateController.deleteAgreementById
 * */
function deleteAgreementById (req, res, next) {
  states.agreements.deleteAgreementById(req.swagger.params, res, next);
}

/**
 * statesAgreementRELOAD.
 * @param {Object} req request
 * @param {Object} res response
 * @param {Object} next next function
 * @alias module:StateController.statesAgreementRELOAD
 * */
function statesAgreementRELOAD (req, res, next) {
  states.agreements.agreementIdRELOAD(req.swagger.params, res, next);
}

/**
 * getAllGuarantees.
 * @param {Object} req request
 * @param {Object} res response
 * @param {Object} next next function
 * @alias module:StateController.getAllGuarantees
 * */
function getAllGuarantees (req, res, next) {
  states.agreements.getAllGuarantees(req, res, next);
}

/**
 * statesAgreementGuaranteesGuaranteeGET.
 * @param {Object} req request
 * @param {Object} res response
 * @param {Object} next next function
 * @alias module:StateController.statesAgreementGuaranteesGuaranteeGET
 * */
function statesAgreementGuaranteesGuaranteeGET (req, res, next) {
  states.agreements.getGuaranteeById(req, res, next);
}

/**
 * statesAgreementMetricsPOST.
 * @param {Object} req request
 * @param {Object} res response
 * @param {Object} next next function
 * @alias module:StateController.statesAgreementMetricsPOST
 * */
function statesAgreementgetAllMetricsStates (req, res, next) {
  states.metrics.getAllMetricsStates(req, res, next);
}

/**
 * statesAgreementMetricsMetricPOST.
 * @param {Object} req request
 * @param {Object} res response
 * @param {Object} next next function
 * @alias module:StateController.statesAgreementMetricsMetricPOST
 * */
function statesAgreementMetricsMetricGET (req, res, next) {
  states.metrics.getMetricStatesById(req, res, next);
}

/**
 * statesAgreementMetricsMetricIncreasePOST.
 * @param {Object} req request
 * @param {Object} res response
 * @param {Object} next next function
 * @alias module:StateController.statesAgreementMetricsMetricIncreasePOST
 * */
function statesAgreementMetricsMetricIncreasePOST (req, res, next) {
  states.metrics.increaseMetricById(req.swagger.params, res, next);
}

/**
 * statesAgreementMetricsMetricPOST.
 * @param {Object} req request
 * @param {Object} res response
 * @param {Object} next next function
 * @alias module:StateController.statesAgreementMetricsMetricPOST
 * */
function statesAgreementMetricsMetricPOST (req, res, next) {
  states.metrics.modifyMetricById(req.swagger.params, res, next);
}

/**
 * statesDELETE.
 * @param {Object} req request
 * @param {Object} res response
 * @param {Object} next next function
 * @alias module:StateController.statesDELETE
 * */
function statesDELETE (req, res, next) {
  states.agreements.statesDELETE(req.swagger.params, res, next);
}

/**
 * statesFilter.
 * @param {Object} req request
 * @param {Object} res response
 * @param {Object} next next function
 * @alias module:StateController.statesFilter
 * */
function statesFilter (req, res, next) {
  states.agreements.statesFilter(req, res, next);
}
