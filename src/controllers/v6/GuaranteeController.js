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

const service = require('../../services/v6/GuaranteeService.js');

module.exports = {
    getGuarantees,
    getAllGuarantees,
    getGuaranteeById,
};

/**
 * getGuarantees.
 * @param {Object} req request
 * @param {Object} res response
 * @param {Object} next next function
 * @alias module:GuaranteeController.getGuarantees
 */
function getGuarantees(req, res, next) {
    service.getGuarantees(req.swagger.params, res, next);
}

/**
 * getAllGuarantees.
 * @param {Object} req request
 * @param {Object} res response
 * @param {Object} next next function
 * @alias module:GuaranteeController.getAllGuarantees
 */
function getAllGuarantees(req, res, next) {
    service.getAllGuarantees(req.swagger.params, res, next);
}

/**
 * getGuaranteeById.
 * @param {Object} req request
 * @param {Object} res response
 * @param {Object} next next function
 * @alias module:GuaranteeController.getGuaranteeById
 */
function getGuaranteeById(req, res, next) {
    service.getGuaranteeById(req.swagger.params, res, next);
}