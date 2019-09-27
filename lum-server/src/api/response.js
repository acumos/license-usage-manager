// ================================================================================
// Copyright (c) 2019 AT&T Intellectual Property. All rights reserved.
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
const {InvalidDataError} = require('../error');

const resHeader = {requestId: "requestId", requested: "requested", status: "status"};
const httpStatuses = {204: "not found", 224: "revoked", 402: "denied"};

module.exports = {
    newReq(req, res, next) {
        res.locals.started = utils.now();
        res.locals.stepStarted = res.locals.started;
        res.locals.requestHttp = {
            method : req.method,
            requestUrl : `${req.protocol}://${req.get('Host')}${req.originalUrl}`,
            'Content-Type' : req.get('Content-Type'),
            remoteAddress : req.connection.remoteAddress, ip : req.ip, ips : req.ips
        };
        res.locals.params = {};
        res.locals.response = {};
        res.locals.dbdata = {};

        res.locals.reqBody = Object.assign({}, req.body || {});
        res.locals.requestId = res.locals.reqBody.requestId || utils.uuid();

        if (req.query.userId && typeof req.query.userId === 'string') {
            res.locals.params.userId = req.query.userId;
            res.locals.response.userId = res.locals.params.userId;
        } else if (res.locals.reqBody.userId) {
            res.locals.params.userId = res.locals.reqBody.userId;
        }

        for (const [key, value] of Object.entries(res.locals.reqBody)) {
            if (typeof value === 'string') {
                res.locals.response[key] = value;
            }
        }
        res.locals.response.requestId = res.locals.requestId;
        res.locals.response.requested = res.locals.reqBody.requested || (new Date()).toISOString();
        res.set(res.locals.response);
        utils.logInfo(res, 'newReq', res.locals.requestHttp, res.locals.reqBody);
        next();
    },
    respond(req, res, next) {
        utils.logInfo(res, `response ${utils.calcReqTime(res)}`, res.statusCode, res.locals.response, 'to', res.locals.requestHttp);
        res.json(res.locals.response);
        next();
    },
    responseError(error, req, res, next) {
        utils.logError(res, "responseError - exception on", error, error.stack);
        if (error instanceof InvalidDataError) {
            res.status(460);
        } else {
            res.status(500);
        }

        utils.logInfo(res, `ERROR response ${utils.calcReqTime(res)}`, res.statusCode, error.stack, 'to', res.locals.requestHttp);
        healthcheck.calcUptime();
        res.json({
            requestId: res.locals.response.requestId,
            requested: res.locals.response.requested,
            "error": {
                severity: error.severity,
                code:     error.code,
                message:  error.message,
                detail:   error.detail,
                where:    error.where,
                items:    error.items,
                stack:    error.stack,
                hint:     error.hint,
                schema:   error.schema,
                table:    error.table,
                column:   error.column,
                pgStep:   utils.getPgStepInfo(res)
            },
            healthcheck: lumServer.healthcheck
        });
        next();
    },
    setHttpStatus(res, statusCode, recordlName) {
        if (res.statusCode && res.statusCode < statusCode) {
            res.status(statusCode);
            const status = `${recordlName} ${httpStatuses[statusCode] || statusCode}`;
            if (statusCode !== 402) {
                res.locals.response.status = status;
            }
            res.set(resHeader.status, status);
            res.set(res.locals.params);
            utils.logInfo(res, "setHttpStatus", res.statusCode, res.locals.response);
        }
    },
    getResHeader(res) {
        return Object.keys(res.locals.params).reduce((target, key) => {target[key] = res.get(key); return target;},
               Object.values(resHeader).reduce((target, value) => {target[value] = res.get(value); return target;}, {}));
    }
};
