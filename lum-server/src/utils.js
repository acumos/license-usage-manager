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
    /**
     * measuring time for performance
     */
    now() {return performance.now();},
    /**
     * uuid version 4
     */
    uuid() {return uuid();},
    /**
     * await sleep(milliSecs) to wake up after milliSecs
     * @param  {} milliSecs
     */
    sleep(milliSecs) {return new Promise(resolve => setTimeout(resolve, milliSecs));},
    /**
     * hide pass* in JSON.stringify
     * @param  {} key
     * @param  {} value
     */
    hidePass(key, value) {return (key && key.startsWith("pass") && "*") || value;},
    /**
     * convert milliSecs to human readable format in days and time
     * @param  {} milliSecs
     */
    milliSecsToString(milliSecs) {
        var seconds = Math.floor(milliSecs / 1000);     milliSecs  -= seconds * 1000;
        var minutes = Math.floor(seconds   / 60);       seconds    -= minutes * 60;
        var hours   = Math.floor(minutes   / 60);       minutes    -= hours * 60;
        const days  = Math.floor(hours     / 24);       hours      -= days * 24;

        return `${days} days ${hours.toString().padStart(2,'0')}:${minutes.toString().padStart(2,'0')}:${seconds.toString().padStart(2,'0')}.${milliSecs}`;
    },
    /**
     * postgres step info for logging
     * @param  {} res
     */
    getPgStepInfo(res) {
        const pg = res.locals.pg;
        if (!pg) {return;}
        return `tx[try(${pg.txRetryCount || ''})${pg.txid || ''}${pg.txStep || ''}]: ${pg.runStep || ''}`;
    },
    /**
     * log the info per request
     * @param  {} res
     * @param  {} ...args
     */
    logInfo(res, ...args) {
        const stepStarted = res.locals.stepStarted || 0;
        res.locals.stepStarted = performance.now();
        lumServer.logger.info(`${res.locals.requestId} [${(res.locals.stepStarted - stepStarted).toFixed(3).padStart(7,' ')} ms]`, ...args);
    },
    /**
     * log the warning per request
     * @param  {} res
     * @param  {} ...args
     */
    logWarn(res, ...args) {
        const stepStarted = res.locals.stepStarted || 0;
        res.locals.stepStarted = performance.now();
        lumServer.logger.warn(`${res.locals.requestId} [${(res.locals.stepStarted - stepStarted).toFixed(3).padStart(7,' ')} ms]`, ...args);
    },
    /**
     * log the error per request
     * @param  {} res
     * @param  {} ...args
     */
    logError(res, ...args) {
        const stepStarted = res.locals.stepStarted || 0;
        res.locals.stepStarted = performance.now();
        lumServer.logger.error(`${res.locals.requestId} [${(res.locals.stepStarted - stepStarted).toFixed(3).padStart(7,' ')} ms]`, ...args);
    },
    /**
     * safely retrieve a field from any object - body
     * @param  {} body
     * @param  {} ...pathInReq
     */
    getFieldByPath(body, ...pathInReq) {
        if (!body || !pathInReq.length) {return;}
        for (const prop of pathInReq) {
            if (!body || !Object.prototype.hasOwnProperty.call(body, prop)) {return;}
            body = body[prop];
        }
        return body;
    },
    /**
     * safely retrieve a field from req.body stored in res.locals.reqBody
     * @param  {} res
     * @param  {} ...pathInReq
     */
    getFromReqByPath(res, ...pathInReq) {
        return this.getFieldByPath(res.locals.reqBody, ...pathInReq);
    },
    /**
     * copy fields with names listed in params from resultBody into target object
     * @param  {} target - copy to target
     * @param  {} params - array of field names
     * @param  {} resultBody - copy existing fields from resultBody
     */
    copyTo(target, params, resultBody) {
        for (const paramName in params) {
            const value = resultBody[paramName];
            if (typeof value !== 'undefined') {
                target[paramName] = value;
            }
        }
    }
};
