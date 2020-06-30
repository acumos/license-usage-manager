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
/**
 * @file reusable functions that are either totally generic or LUM specific
 */

const crypto = require("crypto")
    , uuid = require('uuid');
const {performance} = require('perf_hooks');

const reMultiline = /(\r\n\s*|\n\s*|\r\s*)/gm;

const hmac = {
    salt: 'do not tell',
    cache: {},
    /**
     * first 20 chars of hmac of the value of the field with cacheing
     * @param  {string} key
     * @param  {} value
     * @returns {string} hmac digest of the value
     */
    getDigest: (key, value) => {
        if (!value || typeof value !== 'string') {return value;}
        let digest;
        let cacheKey = hmac.cache[key];
        if (cacheKey) {digest = cacheKey[value];}
        if (digest) {return digest;}
        digest = crypto.createHmac("sha512", hmac.salt).update(value).digest("hex").substr(0,20);
        if (!cacheKey) {cacheKey = hmac.cache[key] = {};}
        cacheKey[value] = digest;
        return digest;
    }
};

module.exports = {
    /**
     * measuring time for performance
     * @returns {number} performance.now()
     */
    now() {return performance.now();},
    /**
     * uuid version 4
     * @returns {string} uuid version 4
     */
    uuid() {return uuid.v4();},
    /**
     * await sleep(milliSecs) to wake up after milliSecs
     * @param  {number} milliSecs
     */
    sleep(milliSecs) {return new Promise(resolve => setTimeout(resolve, milliSecs));},
    /**
     * hide passw* and *password fields as hmac in JSON.stringify
     * @param  {string} key
     * @param  {} value
     * @returns {} either value or hmac of value based on the key
     */
    hidePass(key, value) {
        return (key && key.toLowerCase().includes("passw") && `hmac(${hmac.getDigest(key,value)})`
            ) || value;
    },
    /**
     * remove new line symbols from the text
     * @param  {} text
     * @returns {string} text in one line
     */
    makeOneLine(text) {
        if (typeof(text) === 'string') {
            return text.replace(reMultiline, " ").trimEnd();
        }
        return text;
    },
    /**
     * convert milliSecs to human readable format in days and time
     * @example "2 days 00:03:15.091157"
     * @param   {number} milliSecs
     * @returns {string} human readable format in days and time
     */
    milliSecsToString(milliSecs) {
        let mkSecs  = Math.round(milliSecs * 1000);
        let seconds = Math.floor(mkSecs  / 1000000);  mkSecs  -= seconds * 1000000;  mkSecs  = mkSecs.toString().padStart(6,'0');
        let minutes = Math.floor(seconds / 60);       seconds -= minutes * 60;       seconds = seconds.toString().padStart(2,'0');
        let hours   = Math.floor(minutes / 60);       minutes -= hours * 60;         minutes = minutes.toString().padStart(2,'0');
        let days    = Math.floor(hours   / 24);       hours   -= days * 24;          hours   = hours.toString().padStart(2,'0');
        days = (days ? `${days} day${days==1?'':'s'} `: '');
        return `${days}${hours}:${minutes}:${seconds}.${mkSecs}`;
    },
    /**
     * postgres step info for logging
     * @param  {} res
     * @returns {string} postgres step info
     */
    getPgStepInfo(res) {
        if (!res) {return;}
        const pg = res.locals.pg;
        if (!pg) {return;}
        return `tx[try(${pg.txRetryCount || ''})${pg.txid || ''}${pg.txStep || ''}]: ${pg.runStep || ''}`;
    },
    /**
     * calculate total time from req to response
     * @param  {} res
     * @returns {string} total req time in milliseconds
     */
    calcReqTime(res) {
        return `[${(performance.now() - res.locals.started).toFixed(3).padStart(7,' ')} ms]`;
    },
    /**
     * calculate the step time
     * @param  {} res
     * @returns {string} step time in milliseconds
     */
    trackStepTime(res) {
        const stepStarted = res.locals.stepStarted || 0;
        res.locals.stepStarted = performance.now();
        return `[${(res.locals.stepStarted - stepStarted).toFixed(3).padStart(7,' ')} ms]`;
    },
    /**
     * log prefix with requestId and step timer
     * @param  {} res
     */
    getLogPrefix(res) {
        return (res && typeof res === 'object' && res.locals
            && `${res.locals.requestId} ${module.exports.trackStepTime(res)}`) || '';
    },
    /**
     * log the info per request
     * @param  {} res
     * @param  {...} args
     */
    logInfo(res, ...args) {
        if (res && res.locals.isHealthcheck) {
            lumServer.logForHealthcheck(res, ...args);
        } else {
            lumServer.logger.info(res, ...args);
        }
    },
    /**
     * safely retrieve a field from any object - body
     * @param  {} body
     * @param  {...string} pathInReq
     * @returns {} field value
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
     * @param  {...string} pathInReq
     * @returns {} field value
     */
    getFromReqByPath(res, ...pathInReq) {
        return this.getFieldByPath(res.locals.reqBody, ...pathInReq);
    },
    /**
     * deep copy items from source to items in target
     * @param  {} target
     * @param  {} source
     * @returns target
     */
    deepCopyTo(target, source) {
        if (!target || !source || typeof source !== 'object') {return target;}
        for (const [key, value] of Object.entries(source)) {
            target[key] = JSON.parse(JSON.stringify(value));
        }
        return target;
    },
    /**
     * copy fields with names listed in params from resultBody into target object
     * @param  {} target object to copy into
     * @param  {} params array of field names to copy
     * @param  {} sourceBody copy existing fields keyed in params from sourceBody to target
     */
    copyTo(target, params, sourceBody) {
        if (!sourceBody) {return;}
        for (const paramName in params) {
            const value = sourceBody[paramName];
            if (typeof value !== 'undefined') {
                target[paramName] = JSON.parse(JSON.stringify(value));
            }
        }
    },
    /**
     * add a single denial to the collection of denials
     *      - most denials come directly from SQL instead of through here
     * @param  {Object} swidTag contains usageDenials
     * @param  {string} denialCode ENUM {denied_due_swidTagNotFound, denied_due_agreementNotFound}
     * @param  {string} denialType ENUM {swidTagNotFound, agreementNotFound}
     * @param  {string} denialReason human readable explanation why denied the entitlement
     * @param  {string} deniedAction either requested action on the asset like download, publish, execute, etc.
     *                  or special value of use
     * @param  {} denialReqItemName name of the field that is the reason for denial
     * @param  {} denialReqItemValue valye of the field that is the reason for denial
     */
    addDenial(swidTag, denialCode, denialType,
        denialReason, deniedAction, denialReqItemName, denialReqItemValue) {

        denialReason = module.exports.makeOneLine(denialReason);
        if (!swidTag.usageDenialSummary) {
            swidTag.usageDenialSummary = denialReason;
        }

        swidTag.usageDenials.push({denialCode, denialType, denialReason, deniedAction,
            denialReqItemName, denialReqItemValue
        });
    },
    /**
     * add a request to find swidTag by swTagId and get the right-to-usage
     * dbdata.swidTags[swTagId]
     * @param  {} swidTags
     * @param  {string} swTagId
     * @param  {boolean} [isIncludedAsset] optional flag to indicate that
     *                   the asset of the swidTag is included in composition of another asset
     */
    addSwidTag(swidTags, swTagId, isIncludedAsset) {
        let swidTag = swidTags[swTagId];
        if (swidTag == null) {
            swidTags[swTagId] = swidTag = {
                swTagId: swTagId,
                swidTagBody: null,
                isRtuRequired: null,
                isUsedBySwCreator: null,
                usageDenialSummary: null,
                usageDenials: [],
                rightToUse: null,
                usageMetrics: {
                    usageMetricsId: null,
                    usageType: null,
                    assetUsageRuleId: null,
                    reqUsageCount: 0,
                    reqIncludedUsageCount: 0
                }
            };
        }
        ++swidTag.usageMetrics.reqUsageCount;
        if (isIncludedAsset) {++swidTag.usageMetrics.reqIncludedUsageCount;}
    }
};
