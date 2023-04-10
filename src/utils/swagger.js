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

const fs = require('fs');
const jsyaml = require('js-yaml');
const swaggerTools = require('swagger-tools');

/**
 * Swagger module.
 * @module swagger
 * @see module:utils.swagger
 * @requires fs
 * @requires js-yaml
 * @requires swagger-tools
 * */
module.exports = {
  getRouterOption: _getRouterOption,
  getSwaggerDoc: _getSwaggerDoc,
  initializeMiddleware: _initializeMiddleware
};

/**
 * This method return a the SwaggerRouterOptions object configure with version.
 * @param {Number} version The version of the options required
 * @return {Object} options The object which defines the option that is given to the swagger router component.
 * @alias module:swagger.getRouterOption
 * */
function _getRouterOption (version) {
  return {
    swaggerUi: '/swaggerV' + version + '.json',
    controllers: './src/controllers/v' + version
  };
}

/**
 * This method return an the object with swagger doc information of the 'version' of the api.
 * @param {Number} version The version of the options required
 * @return {Object} swaggerDoc The object which represent the swagger document.
 * @alias module:swagger.getSwaggerDoc
 * */
function _getSwaggerDoc (version) {
  const spec = fs.readFileSync('./src/api/swaggerV' + version + '.yaml', 'utf8');
  return jsyaml.safeLoad(spec);
}

/**
 * This add all necessary middlewares from a list of swagger documents.
 * @param {Express} app app to append middlewares
 * @param {Array} swaggerDocs Array of swagger documents
 * @param {Function} callback The callback
 * @return {Express} app for chaining
 * @alias module:swagger.initializeMiddleware
 * */
function _initializeMiddleware (app, swaggerDocs, callback) {
  swaggerDocs.forEach(function (swaggerDoc, index) {
    swaggerTools.initializeMiddleware(swaggerDoc, function (middleware) {
      // Interpret Swagger resources and attach metadata to request must be first in swagger-tools middleware chain
      app.use(middleware.swaggerMetadata());

      // Validate Swagger requests
      app.use(middleware.swaggerValidator());

      // Route validated requests to appropriate controller
      app.use(middleware.swaggerRouter(module.exports.getRouterOption(swaggerDoc.info.version)));

      // Serve the Swagger documents and Swagger UI
      app.use(middleware.swaggerUi({
        apiDocs: swaggerDoc.basePath + '/api-docs',
        swaggerUi: swaggerDoc.basePath + '/docs'
      }));
    });
  });

  if (callback) {
    callback(app);
  }
  return app;
}
