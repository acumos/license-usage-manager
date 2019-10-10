// ================================================================================
// Copyright (c) 2019 AT&T Intellectual Property. All rights reserved.
// Modifications Copyright (C) 2019 Nordix Foundation.
// ================================================================================
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
// ============LICENSE_END=========================================================
/* eslint-disable no-console */

const winston = require("winston")
    , path = require('path')
    , fs = require("fs")
    , utils = require('./utils');

const logFolder = path.join(__dirname, '../logs');
try {if (!fs.existsSync(logFolder)) {fs.mkdirSync(logFolder);}}
catch (e) {console.error(`failed to create log folder ${logFolder}`, e);}
/**
 * setup the log line format
 */
const logFormatText = winston.format.printf(({level, message, timestamp}) => {
  return `${timestamp} ${level.toUpperCase().padStart(10, ' ')}: ${message}`;
});
/**
 * convert args to the logger into one line string
 * @param  {function} original
 */
const logWrapper = (original) => {
    return (...args) => original(args.map(arg => {
            if (typeof arg === 'object') {return JSON.stringify(arg);}
            if (typeof arg === 'string') {return utils.makeOneLine(arg);}
            return arg;
        }).join(" "));
};

module.exports = {
    /**
     * setup logger
     * @param  {string} serverName name of the server
     */
    initLogger(serverName) {
        const transports = [
            new (winston.transports.Console)()
        ];
        let logFile;
        if (process.env.LOGDIR) {
            logFile = path.join(logFolder, (serverName || '') + '_' + new Date().toISOString().substr(0, 19).replace(/:/g, "") + ".log");
            transports.push(new (winston.transports.File)({ json: false, filename: logFile, maxsize: (100 * 1024 * 1024) }));
        }
        const logger = winston.createLogger({
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.errors({stack: true}),
                logFormatText
            ),
            transports: transports
        });

        logger.error = logWrapper(logger.error);
        logger.warn = logWrapper(logger.warn);
        logger.info = logWrapper(logger.info);
        logger.verbose = logWrapper(logger.verbose);
        logger.debug = logWrapper(logger.debug);
        logger.silly = logWrapper(logger.silly);

        lumServer.logger = logger;
        lumServer.logger.info("-----------------------------------------------------------------------");
        lumServer.logger.info("logger started for", serverName, 'to console', ((logFile && ('and ' + logFile)) || ''));
    }
};