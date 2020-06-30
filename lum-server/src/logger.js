// ================================================================================
// Copyright (c) 2019-2020 AT&T Intellectual Property. All rights reserved.
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
/* eslint-disable no-sync */

const winston = require("winston")
    , path = require('path')
    , fs = require("fs")
    , utils = require('./utils');

const fileRotateSize = 100 * 1024 * 1024;

const logFolder = path.join(__dirname, '../logs');
try {if (!fs.existsSync(logFolder)) {fs.mkdirSync(logFolder);}}
catch (e) {console.error(`failed to create log folder ${logFolder}`, e);}

const logLevels = {
    error: 'error',
    warn: 'warn',
    info: 'info',
    debug: 'debug'
};
const transports = {};
const logFolders = {};

/**
 * gets the vaid log level
 * @param  {string} logLevel
 */
const getLogLevel = (logLevel) => {
    return logLevels[(logLevel || '').toString().toLowerCase()];
};
/**
 * log line format for regular logging
 */
const logFormatText = winston.format.printf(({level, message, timestamp}) => {
  return `${timestamp} ${level.toUpperCase().padStart(10, ' ')}: ${message}`;
});

/**
 * stringify the arg object into a single line
 * @param  {} arg
 * @returns {string}
 */
const logStringify = (arg) => {
    if (typeof arg === 'object') {return JSON.stringify(arg);}
    if (typeof arg === 'string') {return utils.makeOneLine(arg);}
    return arg;
};

/**
 * log line format for stringified json
 */
const logFormatLine = winston.format.printf(({message}) => {return logStringify(message);});

/**
 * convert args to the logger into one line string.
 *      When the first arg is res with locals - creates the logPrefix with requestId and timer
 * @param  {function} original
 */
const logWrapper = (original) => {
    return (...args) => original(args.map((arg, idx) => {
        if (!idx) {
            const logPrefix = utils.getLogPrefix(arg);
            if (logPrefix) {return logPrefix;}
        }
        return logStringify(arg);}
    ).join(" "));
};

const setupMainLogger = () => {
    transports.console = new (winston.transports.Console)({
        level: lumServer.config.logging.logLevel,
        silent: !!process.env.LOG_CONSOLE_OFF || !lumServer.config.logging.logTo.console
    });

    const logFile = path.join(logFolder, `dev_${lumServer.config.serverName}.log`);
    logFolders.devLog = logFolder;
    try {
        transports.devLog = new (winston.transports.File)({
            level: lumServer.config.logging.logLevel,
            silent: !lumServer.config.logging.logTo.devLog,
            filename: logFile,
            tailable: true, maxsize: fileRotateSize, maxFiles: 20, zippedArchive: true,
            options: {flags: 'w'}
        });
        if (lumServer.config.logging.logTo.devLog) {
            lumServer.config.logging.logTo.devLog = logFile;
        }
    } catch (e) {
        console.error(`no dev logging - failed to create log file ${logFile}`, e);
        if (transports.devLog) {
            delete transports.devLog;
        }
        if (lumServer.config.logging.logTo.devLog) {
            delete lumServer.config.logging.logTo.devLog;
        }
    }

    const logger = winston.createLogger({
        format: winston.format.combine(winston.format.timestamp(),
                                       winston.format.errors({stack: true}), logFormatText),
        transports: Object.values(transports)
    });

    logger.error = logWrapper(logger.error);
    logger.warn  = logWrapper(logger.warn);
    logger.info  = logWrapper(logger.info);
    logger.debug = logWrapper(logger.debug);

    lumServer.logger = logger;
};

/**
 * setup the logger for healthcheck into a separate file when writing to log files
 */
const setupLogForHealthcheck = () => {
    const logFile = path.join(logFolder, `healthcheck_${lumServer.config.serverName}.log`);
    logFolders.healthcheck = logFolder;
    try {
        transports.healthcheck = new (winston.transports.File)({
            level: lumServer.config.logging.logLevel,
            silent: !lumServer.config.logging.logTo.healthcheck,
            filename: logFile,
            tailable: true, maxsize: fileRotateSize, maxFiles: 20, zippedArchive: true,
            options: {flags: 'w'}
        });
        const logForHealthcheck = winston.createLogger({
            format: winston.format.combine(winston.format.timestamp(), logFormatText),
            transports: [transports.healthcheck]
        });
        lumServer.logForHealthcheck = logWrapper(logForHealthcheck.debug);
        if (lumServer.config.logging.logTo.healthcheck) {
            lumServer.config.logging.logTo.healthcheck = logFile;
        }
    } catch (e) {
        console.error(`no healthcheck logging - failed to create log file ${logFile}`, e);
        if (transports.healthcheck) {
            delete transports.healthcheck;
        }
        if (lumServer.config.logging.logTo.healthcheck) {
            delete lumServer.config.logging.logTo.healthcheck;
        }
        lumServer.logForHealthcheck = () => {
            /* no logging for healthcheck */
        };
        lumServer.logger.error(`no logForHealthcheck - failed to create log file ${logFile}`, e);
    }

};

/**
 * setup the logger for Acumos logging
 * -- does not rotate the file per Acumos logging platform reqs
 * {@link https://wiki.acumos.org/display/OAM/Acumos+Log+Standards}
 */
const setupLogForAcumos = () => {
    const logFolderForAcumos = path.join(__dirname, '../log-acu', lumServer.config.serverName);
    logFolders.acumos = logFolderForAcumos;
    const logFile = path.join(logFolderForAcumos, `${lumServer.config.serverName}.log`);
    try {
        if (!fs.existsSync(logFolderForAcumos)) {fs.mkdirSync(logFolderForAcumos, {recursive: true});}
        transports.acumos = new (winston.transports.File)({
            level: lumServer.config.logging.logLevel,
            silent: !lumServer.config.logging.logTo.acumos,
            filename: logFile,
            tailable: true, maxsize: fileRotateSize, maxFiles: 20, zippedArchive: true,
            options: {flags: 'w'}
        });
        const logForAcumos = winston.createLogger({format: logFormatLine, transports: [transports.acumos]});
        lumServer.logForAcumos = logWrapper(logForAcumos.info);
        if (lumServer.config.logging.logTo.acumos) {
            lumServer.config.logging.logTo.acumos = logFile;
        }
    } catch (e) {
        console.error(`no logForAcumos - failed to create log file ${logFile}`, e);
        if (transports.acumos) {
            delete transports.acumos;
        }
        if (lumServer.config.logging.logTo.acumos) {
            delete lumServer.config.logging.logTo.acumos;
        }
        lumServer.logForAcumos = () => {
            /* no logging for Acumos */
        };
        lumServer.logger.error(`no logForAcumos - failed to create log file ${logFile}`, e);
    }
};

module.exports = {
    /**
     * setup loggers
     */
    initLogger() {
        lumServer.config.logging          = lumServer.config.logging || {};
        lumServer.config.logging.logLevel = getLogLevel(process.env.LOGGER_LEVEL
                                                    || (lumServer.config.logging || {}).logLevel)
                                                    || logLevels.info;

        lumServer.config.logging.logTo    = lumServer.config.logging.logTo || {};
        if (lumServer.config.logging.logTo.console == null) {
            lumServer.config.logging.logTo.console = true;
        }
        if (!lumServer.config.logging.logTo.devLog && process.env.LOGDIR != null) {
            lumServer.config.logging.logTo.devLog = true;
        }
        if (!lumServer.config.logging.logTo.healthcheck && process.env.LOGDIR != null) {
            lumServer.config.logging.logTo.healthcheck = true;
        }
        if (lumServer.config.logging.logTo.acumos == null) {
            lumServer.config.logging.logTo.acumos = true;
        }

        setupMainLogger();

        lumServer.logger.info("-----------------------------------------------------------------------");
        lumServer.logger.info(`setup loggers on ${lumServer.config.serverName} with logLevel(${
            lumServer.config.logging.logLevel})`);

        setupLogForHealthcheck();
        setupLogForAcumos();

        lumServer.logger.info('logging to:', lumServer.config.logging.logTo);
    },
    /**
     * change the log level on all loggers and/or silence the file loggers
     * @param  {} logging new value for log level and silencing files
     * @example logging = {logLevel: "debug", logTo: {healthcheck: false, acumos: true}}
     */
    setLogging(res, logging) {
        if (!logging) {return;}
        const logLevel = getLogLevel(logging.logLevel);
        if (logLevel && logLevel !== lumServer.config.logging.logLevel) {
            lumServer.logger.info(res, `changing log level from ${lumServer.config.logging.logLevel} to ${logLevel}`);
            lumServer.config.logging.logLevel = logLevel;
        }
        for (const trspKey in transports) {
            const transport = transports[trspKey];
            transport.level = lumServer.config.logging.logLevel;
            if (!logging.logTo || !(trspKey in logging.logTo)) {continue;}
            transport.silent = (logging.logTo[trspKey] === false);

            if (trspKey === 'console') {
                lumServer.config.logging.logTo[trspKey] = !transport.silent;
            } else {
                lumServer.config.logging.logTo[trspKey] = (!transport.silent &&
                    path.join(logFolders[trspKey], transport.filename)) || false;
            }
        }
        lumServer.logger.info('logging settings:', lumServer.config.logging);
    }
};
