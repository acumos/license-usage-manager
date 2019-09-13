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
/**
 * @file reusable functions that are either totally generic or LUM specific
 */

const uuid = require('uuid/v4');

const {performance} = require('perf_hooks');

module.exports = {
    /**
     * measuring time for performance
     * @returns {} performance.now()
     */
    now() {return performance.now();},
    /**
     * uuid version 4
     * @returns {string} uuid version 4
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
     * remove new line symbols from the text
     * @param  {} text
     * @returns {string} text in one line
     */
    makeOneLine(text) {
        if (typeof(text) === 'string') {
            return text.replace(/(\r\n\s*|\n\s*|\r\s*)/gm, " ").trimEnd();
        }
        return text;
    },
    /**
     * convert milliSecs to human readable format in days and time
     * @param  {} milliSecs
     * @returns {string}
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
     * @returns {string} postgres step info
     */
    getPgStepInfo(res) {
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
     * log the info per request
     * @param  {} res
     * @param  {} ...args
     */
    logInfo(res, ...args) {
        lumServer.logger.info(`${res.locals.requestId} ${module.exports.trackStepTime(res)}`, ...args);
    },
    /**
     * log the warning per request
     * @param  {} res
     * @param  {} ...args
     */
    logWarn(res, ...args) {
        lumServer.logger.warn(`${res.locals.requestId} ${module.exports.trackStepTime(res)}`, ...args);
    },
    /**
     * log the error per request
     * @param  {} res
     * @param  {} ...args
     */
    logError(res, ...args) {
        lumServer.logger.error(`${res.locals.requestId} ${module.exports.trackStepTime(res)}`, ...args);
    },
    /**
     * safely retrieve a field from any object - body
     * @param  {} body
     * @param  {} ...pathInReq
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
     * @param  {} ...pathInReq
     * @returns {} field value
     */
    getFromReqByPath(res, ...pathInReq) {
        return this.getFieldByPath(res.locals.reqBody, ...pathInReq);
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
                target[paramName] = value;
            }
        }
    },
    /**
     * add a single denial to the collection of denials
     * @param  {Object[]} denials
     * @param  {string} denialType ENUM {usageConstraint, swidTagNotFound, swidTagRevoked,
     *                             licenseProfileNotFound, licenseProfileRevoked,
     *                             agreementNotFound, agreementNRevoked,
     *                             matchingConstraintOnAssignee, matchingConstraintOnRule}
     * @param  {string} denialReason human readable explanation why denied the entitlement
     * @param  {string} denialReqItemName name of the item that came from req or datetime or asset-action-count
     * @param  {string} denialReqItemValue value of the item that came from req or NOW() or +1 for asset-action-count
     * @param  {string} [deniedAssetUsageAgreementId] id of Asset-Usage-Agreement that caused the denial
     * @param  {string} [deniedAssetUsageAgreementRevision] 1,2,3,... revision of the assetUsageAgreement
     * @param  {string} [deniedRightToUseId] id of rightToUse that caused the denial
     * @param  {string} [deniedRightToUseRevision] 1,2,3,... revision of the rightToUse
     * @param  {string} [deniedConstraint] whole record from usageConstraint or matchingConstraint that caused the denial
     */
    addDenial(denials, denialType, denialReason, denialReqItemName, denialReqItemValue,
        deniedAssetUsageAgreementId, deniedAssetUsageAgreementRevision,
        deniedRightToUseId, deniedRightToUseRevision, deniedConstraint) {
            // "assetUsageDenialSeq": (this._denials.length + 1),
        denials.push({
            "denialType": denialType,
            "denialReason": module.exports.makeOneLine(denialReason),
            "denialReqItemName": denialReqItemName,
            "denialReqItemValue": denialReqItemValue,
            "deniedAssetUsageAgreementId": deniedAssetUsageAgreementId,
            "deniedAssetUsageAgreementRevision": deniedAssetUsageAgreementRevision,
            "deniedRightToUseId": deniedRightToUseId,
            "deniedRightToUseRevision": deniedRightToUseRevision,
            "deniedConstraint": deniedConstraint
        });
    }
};
