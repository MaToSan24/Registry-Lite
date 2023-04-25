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

const { getLogger } = require('governify-commons');
const logger = getLogger().tag('agreement-manager');
const $RefParser = require('json-schema-ref-parser');

import State from '../../models/State.js';
import Agreement from '../../models/Agreement.js';
import { deleteAgreementStatesById, deleteAllAgreementsStates } from './StateService.js';
import ErrorModel from '../../utils/errors.js';

/**
 * Registry agreement module.
 * @module agreements
 * @see module:AgreementController
 * @see module:AgreementService
 * @requires config
 * @requires database
 * @requires StateService
 * @requires errors
 * @requires json-schema-ref-parser
 * */
module.exports = {
  getAllAgreements,
  getAgreementById,
  createAgreement,
  deleteAllAgreements,
  deleteAgreementById,
  getGuaranteesByAgreementId,
  getGuaranteeByAgreementIdAndGuaranteeId
};

/**
 * Get all agreements.
 * @param {Object} args {}
 * @param {Object} res response
 * @param {Object} next next function
 * @alias module:agreement.getAllAgreements
 * */
async function getAllAgreements(args, res) {
  try {
    logger.info('New request to GET agreements agreements/agreements.js');
    const agreements = await Agreement.find();
    logger.info('Agreements returned');
    res.send(agreements);
  } catch (err) {
    logger.error("Error getting all the agreements: ", err);
    res.status(500).json(new ErrorModel(500, err));
  }
}

/**
 * Get an agreement by agreement ID.
 * @param {Object} args {agreement: String}
 * @param {Object} res response
 * @param {Object} next next function
 * @alias module:agreement.getAgreementById
 * */
async function getAgreementById(args, res) {
  try {
    logger.info(`New request to GET agreement with id = ${args.agreement.value}`);
    const agreement = await Agreement.findOne({ id: args.agreement.value });
    if (!agreement) return res.status(404).json(new ErrorModel(404, `There is no agreement with id: ${args.agreement.value}`));

    logger.info(`Agreement with id = ${args.agreement.value} returned`);
    res.send(agreement);
  } catch (err) {
    logger.error(err.toString());
    res.status(500).json(new ErrorModel(500, err));
  }
}

/**
 * Create an agreement
 * @param {Object} args {agreement: String}
 * @param {Object} res response
 * @param {Object} next next function
 * @alias module:agreement.createAgreement
 * */
async function createAgreement(args, res) {
  try {
    const schema = await $RefParser.dereference(args.agreement.value);
    logger.info('Creating new agreement');
    await Agreement.create(schema);
    logger.info('New agreement saved successfully!');

    logger.info('Initializing agreement state');
    await State.create({ agreementId: schema.id, fulfilled: true, scope: {}, metrics: [], guarantees: [] });
    logger.info('State initialized successfully!');

    res.sendStatus(201);
  } catch (err) {
    logger.error("Error creating agreement: ", err);
    res.status(500).json(new ErrorModel(500, err));
  }
}

/**
 * Delete all agreements.
 * @param {Object} args {}
 * @param {Object} res response
 * @param {Object} next next function
 * @alias module:agreement.deleteAllAgreements
 * */
async function deleteAllAgreements(args, res) {
  try {
    logger.info('New request to DELETE all agreements');
    await Agreement.deleteMany({});
    logger.info('Deleted all agreements');
    await deleteAllAgreementsStates(args, res);
    res.sendStatus(200);
  } catch (err) {
    res.sendStatus(404);
    logger.warn("Couldn't delete all agreements: ", err.message);
  }
}

/**
 * Delete an agreement by agreement ID.
 * @param {Object} args {agreement: String}
 * @param {Object} res response
 * @param {Object} next next function
 * @alias module:agreement.deleteAgreementById
 * */
async function deleteAgreementById(args, res) {
  try {
    logger.info(`New request to DELETE agreement with id = ${args.agreement.value}`);
    const agreementId = args.agreement.value;
    if (!agreementId) return res.status(400).send("Cannot delete agreement without an ID");

    const deletedAgreement = await Agreement.findOneAndDelete({ id: agreementId });
    if (!deletedAgreement) return res.status(404).send(`Agreement with ID ${agreementId} not found`);

    args.agreements = args.agreement;
    await deleteAgreementStatesById(args, res);
    logger.info(`Agreement with id = ${args.agreement.value} deleted`);
    res.sendStatus(200);
  } catch (err) {
    logger.error(err.toString());
    res.status(500).json(new ErrorModel(500, err));
  }
}

/**
 * Get all guarantees in an agreement by agreement ID.
 * @param {Object} args {}
 * @param {Object} res response
 * @param {Object} next next function
 * @alias module:agreement.getGuaranteesByAgreementId
 * */
async function getGuaranteesByAgreementId(args, res) {
  try {
    logger.info(`New request to GET terms for agreement with id = ${args.agreement.value}`);
    const agreement = await Agreement.findOne({ id: args.agreement.value });
    if (!agreement) return res.status(404).json({ message: `Agreement with id ${args.agreement.value} not found` });

    const guarantees = agreement.terms?.guarantees;
    if (!guarantees || guarantees.length === 0) return res.status(404).json({ message: `No guarantees found for agreement with id ${args.agreement.value}` });

    logger.info(`Terms for agreement with id = ${args.agreement.value} returned`);
    res.send(guarantees);
  } catch (err) {
    logger.error(err);
    res.sendStatus(500);
  }
}


/**
 * Get a specific guarantee for an agreement.
 * @param {Object} args { agreement: String, guarantee: String }
 * @param {Object} res response
 * @param {Object} next next function
 * @alias module:agreement.getGuaranteeByAgreementIdAndGuaranteeId
 */
async function getGuaranteeByAgreementIdAndGuaranteeId(args, res) {
  try {
    logger.info(`New request to GET the guarantee with id = ${args.guarantee.value} for agreement with id = ${args.agreement.value} `);
    const agreement = await Agreement.findOne({ id: args.agreement.value });
    if (!agreement) return res.status(404).json({ message: `Agreement with id ${args.agreement.value} not found` });

    const guarantee = agreement.terms?.guarantees.find((guarantee) => guarantee.id === args.guarantee.value);
    if (!guarantee) return res.status(404).json({ message: `Guarantee with id ${args.guarantee.value} not found` });

    logger.info(`Guarantee with id = ${args.guarantee.value} for agreement with id = ${args.agreement.value} returned`);
    res.send(guarantee);
  } catch (err) {
    logger.error(err);
    res.sendStatus(500);
  }
}