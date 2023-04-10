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

const states = require('../../controllers/v6/states/states');
const ErrorModel = require('../../../errors/index.js').errorModel;

import State from '../../models/State.js';
import Agreement from '../../models/Agreement.js';

import { statesDELETE } from '../../controllers/v6/states/agreements/agreements.js'

/**
 * Registry agreement module.
 * @module agreements
 * @see module:AgreementController
 * @see module:AgreementService
 * @requires config
 * @requires database
 * @requires states
 * @requires StateService
 * @requires errors
 * @requires json-schema-ref-parser
 * */
module.exports = {
  createAgreement,
  deleteAllAgreements,
  getAllAgreements,
  getAgreementById,
  deleteAgreementById,
  getTermsByAgreementId,
  getGuaranteesByAgreementId
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
    res.status(200).json(agreements);
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
    const agreement = await Agreement.findOne({ id: args.agreement.value });
    if (!agreement) {
      logger.warn(`There is no agreement with id: ${args.agreement.value}`);
      return res.status(404).json(new ErrorModel(404, `There is no agreement with id: ${args.agreement.value}`));
    }
    logger.info(`Agreement with id = ${args.agreement.value} returned`);
    res.status(200).json(agreement);
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

    res.sendStatus(200);
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
    await statesDELETE(args, res);
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
    const agreementId = args.agreement.value;
    if (!agreementId) {
      return res.status(400).send("Can't delete agreement without an ID");
    }
    const deletedAgreement = await Agreement.findOneAndDelete({ id: agreementId });
    if (!deletedAgreement) {
      return res.status(404).send(`Agreement with ID ${agreementId} not found`);
    }
    logger.info(`Agreement with ID ${agreementId} successfully deleted`);
    args.agreements = args.agreement;
    states.agreements.deleteAgreementById(args, res);
  } catch (err) {
    logger.error(err.toString());
    res.status(500).json(new ErrorModel(500, err));
  }
}

/**
 * Get all agreement terms.
 * @param {Object} args {}
 * @param {Object} res response
 * @param {Object} next next function
 * @alias module:agreement.getTermsByAgreementId
 * */
async function getTermsByAgreementId(args, res) {
  try {
    const agreement = await Agreement.findOne({ id: args.agreement.value });
    if (!agreement) {
      return res.status(404).json({ message: `Agreement with id ${args.agreement.value} not found` });
    }
    res.json(agreement.terms.guarantees);
  } catch (err) {
    logger.error(err);
    res.sendStatus(500);
  }
}


/**
 * Get all agreement guarantees.
 * @param {Object} args {agreement: String, guarantee: String}
 * @param {Object} res response
 * @param {Object} next next function
 * @alias module:agreement.getGuaranteesByAgreementId
 * */
async function getGuaranteesByAgreementId(args, res) {
  try {
    const agreement = await Agreement.findOne({ id: args.agreement.value });
    if (!agreement) {
      return res.status(404).send('Agreement not found');
    }
    const guarantee = agreement[0].terms.guarantees.find(guarantee => guarantee.id === args.guarantee.value);
    if (!guarantee) {
      return res.status(404).send('Guarantee not found');
    }
    res.send(guarantee);
  } catch (err) {
    logger.error(err);
    res.sendStatus(500);
  }
}