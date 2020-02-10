// ================================================================================
// Copyright (c) 2019-2020 AT&T Intellectual Property. All rights reserved.
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

const utils = require('../utils');
const healthcheck = require('./healthcheck');
const lumErrors = require('../error');

const resHeader = {requestId: "requestId", requested: "requested", status: "status"};

const lumHttpCodes = {notFound: 204, revoked: 224, denied: 402, invalidDataError: 400, serverError: 500};
const httpStatuses = {[lumHttpCodes.notFound]: "Not Found", [lumHttpCodes.revoked]: "Revoked", [lumHttpCodes.denied]: "Denied"};

module.exports = {
    /**
     * on every new req received by lum-server - set the locals in res
     * @param  {} req
     * @param  {} res
     * @param  {} next
     */
    newReq(req, res, next) {
        res.locals.started = utils.now();
        res.locals.stepStarted = res.locals.started;
        res.locals.requestHttp = {
            method: req.method, requestUrl: `${req.protocol}://${req.get('Host')}${req.originalUrl}`,
            query: req.query, 'Content-Type': req.get('Content-Type'),
            remoteAddress: req.connection.remoteAddress, ip: req.ip, ips: req.ips
        };
        res.locals.isHealthcheck = req.path.includes('/healthcheck');
        res.locals.params = {};
        res.locals.response = {};
        res.locals.dbdata = {};

        res.locals.reqBody = utils.deepCopyTo({}, req.body || {});
        res.locals.requestId = res.locals.reqBody.requestId || utils.uuid();

        if (req.query.userId && typeof req.query.userId === 'string') {
            res.locals.params.userId = req.query.userId;
            res.locals.response.userId = res.locals.params.userId;
        } else if (res.locals.reqBody.userId) {
            res.locals.params.userId = res.locals.reqBody.userId;
        }

        for (const [paramKey, paramValue] of Object.entries(req.query)) {
            if (paramValue && typeof paramValue === 'string') {
                res.locals.params[paramKey] = paramValue;
            }
        }
        res.locals.paramKeys = JSON.stringify(res.locals.params);

        for (const [key, value] of Object.entries(res.locals.reqBody)) {
            if (value && typeof value === 'string') {
                res.locals.response[key] = value;
            }
        }
        res.locals.response.requestId = res.locals.requestId;
        res.locals.response.requested = res.locals.reqBody.requested || (new Date()).toISOString();
        res.set(res.locals.response);
        res.set(res.locals.params);
        utils.logInfo(res, 'newReq', res.locals.requestHttp, res.locals.reqBody);
        next();
    },
    /**
     * validate param in query by name paramName
     * @param  {} res
     * @param  {...string} paramNames
     * @throws {InvalidDataError} when paramName of type string not received in query
     */
    validateParamInQuery(res, ...paramNames) {
        const params = [];
        const errors = [];
        for (const paramName of paramNames) {
            let paramValue = res.locals.params[paramName];
            if (paramValue) {
                params.push(`${paramName}(${paramValue})`);
                continue;
            }

            paramValue = res.locals.requestHttp.query[paramName];
            if (!paramValue) {
                lumErrors.addError(errors,
                    `expected ?${paramName}=<string> in ${res.locals.requestHttp.method} ${res.locals.requestHttp.requestUrl}`
                );
            } else {
                lumErrors.addError(errors,
                    `expected string value for ?${paramName}=<string> in ${res.locals.requestHttp.method} ${res.locals.requestHttp.requestUrl}`,
                    paramName, paramValue
                );
            }
        }
        if (errors.length) {
            throw new lumErrors.InvalidDataError(errors);
        }
        utils.logInfo(res, `params: ${params.join()}`);
    },
    /**
     * send the response back to the client at the end of successful request processing
     * @param  {} req
     * @param  {} res
     * @param  {} next
     */
    respond(req, res, next) {
        utils.logInfo(res, `response ${utils.calcReqTime(res)}`, res.statusCode, res.locals.response,
            'to', res.locals.requestHttp, 'headers:', module.exports.getResHeader(res));
        res.json(res.locals.response);
        next();
    },
    /**
     * send an error back to the client on interrupted request processing
     * @param  {} error
     * @param  {} req
     * @param  {} res
     * @param  {} next
     */
    responseError(error, req, res, next) {
        utils.logError(res, "responseError - exception on", error, error.stack);
        if (error instanceof lumErrors.InvalidDataError) {
            res.status(lumHttpCodes.invalidDataError);
        } else {
            res.status(lumHttpCodes.serverError);
        }

        utils.logInfo(res, `ERROR response ${utils.calcReqTime(res)}`, res.statusCode, error.stack,
            'to', res.locals.requestHttp, 'headers:', module.exports.getResHeader(res));
        healthcheck.calcUptime();
        if (res.statusCode < lumHttpCodes.serverError && error.stack) {delete error.stack;}
        res.json({
            requestId: res.locals.response.requestId,
            requested: res.locals.response.requested,
            "error": {
                name:     error.name,
                severity: error.severity,
                code:     error.code,
                message:  error.message,
                detail:   error.detail,
                where:    error.where,
                items:    error.items,
                stack:    error.stack,
                hint:     error.hint,
                position: error.position,
                schema:   error.schema,
                table:    error.table,
                column:   error.column,
                pgStep:   utils.getPgStepInfo(res)
            },
            healthcheck: lumServer.healthcheck
        });
        next();
    },
    /**
     * non-200 http status codes returned by lum-server
     * @enum {number} notFound: 204, revoked: 224, denied: 402, invalidDataError: 400, serverError: 500
     */
    lumHttpCodes: lumHttpCodes,
    /**
     * set the http status at any time of the request processing
     * @param  {} res
     * @param  {} statusCode
     * @param  {} recordlName
     */
    setHttpStatus(res, statusCode, recordlName) {
        if (res.statusCode && res.statusCode < statusCode) {
            const statusMessage = httpStatuses[statusCode];
            if (statusMessage) {res.statusMessage = statusMessage;}
            res.status(statusCode);

            const status = `${recordlName} ${(statusMessage || statusCode).toString().toLowerCase()}`;
            if (statusCode !== lumHttpCodes.denied) {
                res.locals.response.status = status;
            }
            res.set(resHeader.status, status);
            res.set(res.locals.params);
            utils.logInfo(res, "setHttpStatus", res.statusCode, res.locals.response);
        }
    },
    /**
     * convenience for logging the http header and top locals params in response
     * @param  {} res
     */
    getResHeader(res) {
        return Object.keys(res.locals.params).reduce((target, key) => {target[key] = res.get(key); return target;},
               Object.values(resHeader).reduce((target, value) => {target[value] = res.get(value); return target;}, {}));
    }
};
