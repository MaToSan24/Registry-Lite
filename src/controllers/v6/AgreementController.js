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

const agreements = require('../../services/v6/AgreementService.js');

/**
 * Registry agreement module.
 * @module AgreementController
 * @see module:AgreementService
 * @see module:agreements
 * @requires AgreementService
 * */
module.exports = {
  getAllAgreements,
  getAgreementById,
  createAgreement,
  deleteAllAgreements,
  deleteAgreementById,
  getTermsByAgreementId,
  getGuaranteesByAgreementId
};

/**
 * getAllAgreements.
 * @param {Object} req request
 * @param {Object} res response
 * @param {Object} next next function
 * @alias module:AgreementController.getAllAgreements
 * */
function getAllAgreements (req, res, next) {
  agreements.getAllAgreements(req.swagger.params, res, next);
}

/**
 * getAgreementById.
 * @param {Object} req request
 * @param {Object} res response
 * @param {Object} next next function
 * @alias module:AgreementController.getAgreementById
 * */
function getAgreementById (req, res, next) {
  agreements.getAgreementById(req.swagger.params, res, next);
}

/**
 * createAgreement.
 * @param {Object} req request
 * @param {Object} res response
 * @param {Object} next next function
 * @alias module:AgreementController.createAgreement
 * */
function createAgreement (req, res, next) {
  agreements.createAgreement(req.swagger.params, res, next);
}

/**
 * deleteAllAgreements.
 * @param {Object} req request
 * @param {Object} res response
 * @param {Object} next next function
 * @alias module:AgreementController.deleteAllAgreements
 * */
function deleteAllAgreements (req, res, next) {
  agreements.deleteAllAgreements(req.swagger.params, res, next);
}

/**
 * deleteAgreementById.
 * @param {Object} req request
 * @param {Object} res response
 * @param {Object} next next function
 * @alias module:AgreementController.deleteAgreementById
 * */
function deleteAgreementById (req, res, next) {
  agreements.deleteAgreementById(req.swagger.params, res, next);
}

/**
 * getTermsByAgreementId.
 * @param {Object} req request
 * @param {Object} res response
 * @param {Object} next next function
 * @alias module:AgreementController.getTermsByAgreementId
 * */
function getTermsByAgreementId (req, res, next) {
  agreements.getTermsByAgreementId(req.swagger.params, res, next);
}

/**
 * getGuaranteesByAgreementId.
 * @param {Object} req request
 * @param {Object} res response
 * @param {Object} next next function
 * @alias module:AgreementController.getGuaranteesByAgreementId
 * */
function getGuaranteesByAgreementId (req, res, next) {
  agreements.getGuaranteesByAgreementId(req.swagger.params, res, next);
}