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
const logger = governify.getLogger().tag('error-handler');

class ErrorModel extends Error {
  constructor(code, message, root) {
    super(message);
    this.code = code;
    this.root = root;
  }

  getStackTrace(top) {
    let message = this.message;
    if (top && this.root) {
      message += '\nError trace: ';
    }
    if (this.root && this.root instanceof ErrorModel) {
      message += '\n\t' + this.root.getStackTrace(false);
    } else if (this.root) {
      message += '\n\t' + this.root.toString();
    }
    return message;
  }
}

function handleError(level, functionName, code, message, root) {
  const regexp = /\(.+\)|at\s+.+\d$/;
  const stack = new Error().stack.split('\n')[3];
  let at = regexp.exec(stack)[0];

  const projectRoot = require('path').dirname(require.main.filename);

  if (at && at[0] === '(') {
    at = at.replace('(', '').replace(')', '')
      .substring(projectRoot.length, at.length);
  } else if (at && at[0] === 'a') {
    at = at.substring(3 + projectRoot.length, at.length);
  } else if (!at) {
    at = stack;
  }

  const errorMessage = `[${level}][${functionName}] - ${message} at .${at}`;
  const error = new ErrorModel(code, errorMessage, root);

  if (config.errors.progressiveTrace) {
    logger.error(error.getStackTrace(true));
  } else {
    logger.error(error.toString());
  }

  return error;
}

function handlePromiseError(reject, level, functionName, code, message, root) {
  const error = handleError(level, functionName, code, message, root);
  reject(error);
}

function handleControllerError(res, level, functionName, code, message, root) {
  const error = handleError(level, functionName, code, message, root);
  res.status(code).json({ error });
}

module.exports = {
  ErrorModel,
  handleError,
  handlePromiseError,
  handleControllerError,
};
