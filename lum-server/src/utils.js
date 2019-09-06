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

const uuid = require('uuid/v4');

const {performance} = require('perf_hooks');

module.exports = {
    now() {return performance.now();},
    uuid() {return uuid();},
    hidePass(key, value) {return (key && key.startsWith("pass") && "*") || value;},
    milliSecsToString(milliSecs) {
        var seconds = Math.floor(milliSecs / 1000);     milliSecs  -= seconds * 1000;
        var minutes = Math.floor(seconds   / 60);       seconds    -= minutes * 60;
        var hours   = Math.floor(minutes   / 60);       minutes    -= hours * 60;
        const days  = Math.floor(hours     / 24);       hours      -= days * 24;

        return `${days} days ${hours.toString().padStart(2,'0')}:${minutes.toString().padStart(2,'0')}:${seconds.toString().padStart(2,'0')}.${milliSecs}`;
    },
    logInfo(res, ...args) {
        const stepStarted = res.locals.stepStarted || 0;
        res.locals.stepStarted = performance.now();
        lumServer.logger.info(`${res.locals.requestId} [${(res.locals.stepStarted - stepStarted).toFixed(3).padStart(7,' ')} ms]`, ...args);
    },
    logWarn(res, ...args) {
        const stepStarted = res.locals.stepStarted || 0;
        res.locals.stepStarted = performance.now();
        lumServer.logger.warn(`${res.locals.requestId} [${(res.locals.stepStarted - stepStarted).toFixed(3).padStart(7,' ')} ms]`, ...args);
    },
    logError(res, ...args) {
        const stepStarted = res.locals.stepStarted || 0;
        res.locals.stepStarted = performance.now();
        lumServer.logger.error(`${res.locals.requestId} [${(res.locals.stepStarted - stepStarted).toFixed(3).padStart(7,' ')} ms]`, ...args);
    },
    getFieldByPath(body, ...pathInReq) {
        if (!body || !pathInReq.length) {return;}
        for (const prop of pathInReq) {
            if (!body || !Object.prototype.hasOwnProperty.call(body, prop)) {return;}
            body = body[prop];
        }
        return body;
    },
    getFromReqByPath(res, ...pathInReq) {
        return this.getFieldByPath(res.locals.reqBody, ...pathInReq);
    },
    copyTo(target, params, resultBody) {
        for (const paramName in params) {
            const value = resultBody[paramName];
            if (typeof value !== 'undefined') {
                target[paramName] = value;
            }
        }
    }
};
