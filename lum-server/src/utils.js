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
     * @returns {number} performance.now()
     */
    now() {return performance.now();},
    /**
     * uuid version 4
     * @returns {string} uuid version 4
     */
    uuid() {return uuid();},
    /**
     * await sleep(milliSecs) to wake up after milliSecs
     * @param  {number} milliSecs
     */
    sleep(milliSecs) {return new Promise(resolve => setTimeout(resolve, milliSecs));},
    /**
     * hide pass* and *password fields in JSON.stringify
     * @param  {string} key
     * @param  {} value
     */
    hidePass(key, value) {return (key && key.toLowerCase().includes("passw") && "*") || value;},
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
     * log the info per request
     * @param  {} res
     * @param  {...} args
     */
    logInfo(res, ...args) {
        const logPrefix = (res && `${res.locals.requestId} ${module.exports.trackStepTime(res)}`) || '';
        if (res && res.locals.isHealthcheck) {
            lumServer.logForHealthcheck(logPrefix, ...args);
        } else {
            lumServer.logger.info(logPrefix, ...args);
        }
    },
    /**
     * log the warning per request
     * @param  {} res
     * @param  {...} args
     */
    logWarn(res, ...args) {
        lumServer.logger.warn(`${res.locals.requestId} ${module.exports.trackStepTime(res)}`, ...args);
    },
    /**
     * log the error per request
     * @param  {} res
     * @param  {...} args
     */
    logError(res, ...args) {
        const logPrefix = (res && `${res.locals.requestId} ${module.exports.trackStepTime(res)}`) || '';
        lumServer.logger.error(logPrefix, ...args);
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
     * @param  {Object} swidTag contains usageDenials
     * @param  {string} denialType ENUM {swidTagNotFound, swidTagRevoked,
     *                                   licenseProfileNotFound, licenseProfileRevoked,
     *                                   agreementNotFound, rightToUseRevoked, usageProhibited,
     *                                   matchingConstraintOnAssignee, matchingConstraintOnTarget,
     *                                   timingConstraint, usageConstraint}
     * @param  {string} denialReason human readable explanation why denied the entitlement
     * @param  {string} deniedAction either requested action on the asset like download, publish, execute, etc.
     *                  or special value of use
     * @param  {string} denialReqItemName name of the item that came from req or datetime or asset-action-count
     * @param  {} denialReqItemValue value of the item that came from req or NOW() or +1 for asset-action-count
     * @param  {string} [deniedAssetUsageAgreementId] id of Asset-Usage-Agreement that caused the denial
     * @param  {string} [deniedAssetUsageAgreementRevision] 1,2,3,... revision of the assetUsageAgreement
     * @param  {string} [deniedRightToUseId] id of rightToUse that caused the denial
     * @param  {string} [deniedRightToUseRevision] 1,2,3,... revision of the rightToUse
     * @param  {} [deniedConstraint] whole record from usageConstraint or assignee refinement that caused the denial
     * @param  {} [deniedMetrics] current statistical data that caused the denial
     */
    addDenial(swidTag, denialType, denialReason, deniedAction, denialReqItemName, denialReqItemValue,
        deniedAssetUsageAgreementId, deniedAssetUsageAgreementRevision,
        deniedRightToUseId, deniedRightToUseRevision, deniedConstraint, deniedMetrics) {

        denialReason = module.exports.makeOneLine(denialReason);
        if (!swidTag.usageDenialSummary) {
            swidTag.usageDenialSummary = denialReason;
        }

        swidTag.usageDenials.push({
            "denialType": denialType,
            "denialReason": denialReason,
            "deniedAction": deniedAction,
            "deniedAssetUsageAgreementId": deniedAssetUsageAgreementId,
            "deniedAssetUsageAgreementRevision": deniedAssetUsageAgreementRevision,
            "deniedRightToUseId": deniedRightToUseId,
            "deniedRightToUseRevision": deniedRightToUseRevision,
            "denialReqItemName": denialReqItemName,
            "denialReqItemValue": denialReqItemValue,
            "deniedConstraint": deniedConstraint,
            "deniedMetrics": deniedMetrics
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
