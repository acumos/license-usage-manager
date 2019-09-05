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

const resHeader = {requestId: "requestId", requested: "requested", status: "status"};
const httpStatuses = {204: "not found", 224: "revoked"};

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
        utils.logInfo(res, `response [${(utils.now() - res.locals.started).toFixed(3).padStart(7,' ')} ms]`, res.statusCode, res.locals.response, 'to', res.locals.requestHttp);
        res.json(res.locals.response);
        next();
    },
    responseError(exception, req, res, next) {
        utils.logError(res, "responseError - exception on", exception, exception.stack);
        res.status(500);
        utils.logInfo(res, `ERROR response [${(utils.now() - res.locals.started).toFixed(3).padStart(7,' ')} ms]`, res.statusCode, exception.stack, 'to', res.locals.requestHttp);
        res.json({"error":{"code":exception.code, "stack": exception.stack}});
        next();
    },
    isOk(res) {return (res.statusCode === 200);},
    setHttpStatus(res, statusCode, recordlName) {
        if (res.statusCode && res.statusCode < statusCode) {
            res.status(statusCode);
            res.locals.response.status = `${recordlName} ${httpStatuses[statusCode] || statusCode}`;
            res.set(resHeader.status, res.locals.response.status);
            res.set(res.locals.params);
            utils.logInfo(res, "setHttpStatus", res.statusCode, res.locals.response);
        }
    },
    getResHeader(res) {
        return Object.keys(res.locals.params).reduce((target, key) => {target[key] = res.get(key); return target;},
               Object.values(resHeader).reduce((target, value) => {target[value] = res.get(value); return target;}, {}));
    }
};
