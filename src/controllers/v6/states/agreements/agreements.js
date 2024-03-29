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
const logger = governify.getLogger().tag('agreement-state-manager');
const db = require('../../../../database');
const stateManager = require('../../../../stateManager/v6/state-manager.js');
const calculators = require('../../../../stateManager/v6/calculators.js');

const Promise = require('bluebird');
const request = require('request');
const JSONStream = require('JSONStream');

/**
 * Agreement state module.
 * @module agreementsState
 * @see module:states
 * @requires config
 * @requires stateManager
 * @requires calculators
 * @requires bluebird
 * @requires request
 * */
module.exports = {
  getAgreementById,
  deleteAgreementById,
  agreementIdRELOAD,
  statesDELETE,
  getAllGuarantees: require('../guarantees/guarantees.js').getAllGuarantees,
  getGuaranteeById: require('../guarantees/guarantees.js').getGuaranteeById,
  statesFilter
};

/**
 * Get an agreement state by agreement ID.
 * @param {Object} args {agreement: String}
 * @param {Object} res response
 * @param {Object} next next function
 * @alias module:agreements.getAgreementById
 * */
function getAgreementById (args, res) {
  logger.info('New request to GET agreements (states/agreements/agreements.js)');
  const agreementId = args.agreement.value;

  stateManager({
    id: agreementId
  }).then(function (manager) {
    manager.get(agreementId).then(function (agreement) {
      res.json(agreement);
    }, function (err) {
      logger.error(err.message.toString());
      res.status(err.code).json(err);
    });
  }, function (err) {
    logger.error(err.message.toString());
    res.status(err.code).json(err);
  });
}

/**
 * Delete an agreement state by agreement ID.
 * @param {Object} args {agreement: String, from: String, to: String}
 * @param {Object} res response
 * @param {Object} next next function
 * @alias module:agreements.deleteAgreementById
 * */
function deleteAgreementById (args, res) {
  const agreementId = args.agreement.value;
  logger.info('New request to DELETE agreement state for agreement ' + agreementId);
  if (agreementId) {
    const StateModel = db.models.StateModel;
    StateModel.remove({
      agreementId: agreementId
    }, function (err) {
      if (!err) {
        res.sendStatus(200);
        logger.info('Deleted state for agreement ' + agreementId);
      } else {
        res.sendStatus(404);
        logger.warn("Can't delete state for agreement " + agreementId + ' :' + err);
      }
    });
  } else {
    res.sendStatus(400);
    logger.warn("Can't delete state for agreement " + agreementId);
  }
}

/**
 * Delete all agreement states
 * @param {Object} args {agreement: String}
 * @param {Object} res response
 * @param {Object} next next function
 * @alias module:agreements.statesDELETE
 * */
function statesDELETE (args, res) {
  logger.info('New request to DELETE all agreement states');
  const StateModel = db.models.StateModel;
  StateModel.remove(function (err) {
    if (!err) {
      res.sendStatus(200);
      logger.info('Deleted state for all agreements');
    } else {
      res.sendStatus(404);
      logger.warn("Can't delete state for all agreements: " + err);
    }
  });
}

/**
 * States filter
 * @param {Object} req {agreement: String}
 * @param {Object} res response
 * @param {Object} next next function
 * @alias module:agreements.statesFilter
 * */
function statesFilter (req, res) {
  logger.info('New request to GET filtered agreements states (states/agreements/agreements.js) with params: ' + JSON.stringify(req.query));

  const agreementId = req.swagger.params.agreement.value;
  const indicator = req.query.indicator;
  const type = req.query.type;
  const from = req.query.from;
  const to = req.query.to;
  const at = req.query.at;

  // Recreate scopes object
  const scopeQuery = {};
  let groupQuery = {};
  for (const property in req.query) {
    if (property.startsWith('scope.')) {
      if (req.query[property] === '*') {
        scopeQuery[property] = {
          $exists: true
        };
      } else {
        if (req.query[property] === NaN) {
          scopeQuery[property] = {

            $eq: req.query[property]
          };
        } else {
          scopeQuery[property] = {

            $eq: parseInt(req.query[property])
          };
        }
      }

      groupQuery = {
        $group: { _id: '$' + property, evidences: { $push: '$records.evidences' } }
      };
    }
  }

  const StateModel = db.models.StateModel;

  const andQuery = {
    agreementId: {
      $eq: agreementId
    },
    id: {
      $eq: indicator
    },
    stateType: {
      $eq: type
    },
    'period.from': {
      $eq: from || at
    }

  };

  if (to) {
    Object.assign(andQuery, {
      'period.to': {
        $eq: to
      }
    });
  }

  Object.assign(andQuery, scopeQuery); // Concat scope properties to the query

  StateModel.aggregate([{
    $match: {
      $and: [andQuery]
    }
  },
  {
    $unwind: '$records'
  }
    //, groupQuery?groupQuery:{}

  ])
    .allowDiskUse(true)
    .cursor()
    .exec()
    .pipe(JSONStream.stringify())
    .pipe(res);
}

/**
 * Reload an agreement state by agreement ID.
 * @param {Object} args {agreement: String, from: String, to: String}
 * @param {Object} res response
 * @param {Object} next next function
 * @alias module:agreements.agreementIdRELOAD
 * */
function agreementIdRELOAD (args, res) {
  const agreementId = args.agreements.value;
  const parameters = args.parameters.value;

  logger.info('New request to reload state of agreement ' + agreementId);

  const StateModel = db.models.StateModel;
  StateModel.find({
    agreementId: agreementId
  }).remove(function (err) {
    const errors = [];
    if (!err) {
      const message = 'Reloading state of agreement ' + agreementId + '. '
      res.end(message);

      logger.info('Deleted state for agreement ' + agreementId);

      const AgreementModel = db.models.AgreementModel;
      AgreementModel.findOne({
        id: agreementId
      }, function (err, agreement) {
        if (err) {
          logger.error(err.toString());
          errors.push(err);
        }
        stateManager({
          id: agreementId
        }).then(function (manager) {
          logger.info('Calculating agreement state...');
          calculators.agreementCalculator.process(manager, parameters.requestedState).then(function () {
            logger.debug('Agreement state has been calculated successfully');
            if (errors.length > 0) {
              logger.error('Agreement state reload has been finished with ' + errors.length + ' errors: \n' + JSON.stringify(errors));
            } else {
              logger.info('Agreement state reload has been finished successfully');
            }
          }, function (err) {
            logger.error(err.message.toString());
            errors.push(err);
          });
        }, function (err) {
          logger.error(err.message.toString());
          errors.push(err);
        });
      });
    } else {
      logger.error("Can't delete state for agreement " + agreementId + ' :' + err);
      errors.push(err);
    }
  });
}