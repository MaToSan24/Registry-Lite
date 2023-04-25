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
const config = governify.configurator.getConfig('main');
const logger = governify.getLogger().tag('db-manager');

import mongoose from 'mongoose';

/**
 * Database module.
 * @module database
 * @requires config
 * @requires mongoose
 * */
module.exports = {
  connect,
  close
};

/**
 * Create a new database connection.
 * @param {callback} callback callback connect function
 * @alias module:database.connect
 * */
function connect (callback) {
  const instance = this;
  let db = null;
  const options = {
    keepAlive: true,
    reconnectTries: Number.MAX_VALUE, // Never stop trying to reconnect
    reconnectInterval: 3000,
    useCreateIndex: true
  };
  const databaseFullURL = governify.infrastructure.getServiceURL('internal.database.mongo-registry') + '/' + config.database.name;
  logger.info('Connecting to ' + databaseFullURL);
  mongoose.connect(databaseFullURL, options).then(() => {
    db = mongoose.connection;

    logger.info('Connected to db!');
    instance.db = db;
    if (callback) {
      callback();
    }
  }).catch(err => {
    if (callback) {
      callback(err);
    }
  });
}

/**
 * Close an existing database connection.
 * @param {callback} done callback function when connection closes
 * @alias module:db.close
 * */
function close (done) {
  const instance = this;
  if (this.db) {
    this.db.close(function (err) {
      instance.db = null;
      done(err);
    });
  }
}