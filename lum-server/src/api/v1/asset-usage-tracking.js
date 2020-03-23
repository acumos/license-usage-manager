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

const response = require('../response');
const pgclient = require('../../db/pgclient');
const dbAssetUsage = require('../../db/asset-usage');
const lumErrors = require('../../error');

/**
 * validate params received in query
 *  - softwareLicensorId
 *  - startDateTime
 *  - endDateTime
 * @param  {} req
 * @param  {} res
 * @param  {} next
 * @throws {InvalidDataError} when invalid date-time format on startDateTime or endDateTime
 */
const validateParams = (req, res, next) => {
    response.validateParamInQuery(res, 'softwareLicensorId');

    const errors = [];
    if (res.locals.params.startDateTime) {
        const startDateTime = new Date(res.locals.params.startDateTime);
        if (isNaN(startDateTime.getTime())) {
            lumErrors.addError(errors, `expected date-time value for startDateTime(${res.locals.params.startDateTime})`);
        } else {
            res.locals.params.startDateTime = startDateTime.toISOString();
        }
    }

    if (res.locals.params.endDateTime) {
        const endDateTime = new Date(res.locals.params.endDateTime);
        if (isNaN(endDateTime.getTime())) {
            lumErrors.addError(errors, `expected date-time value for endDateTime(${res.locals.params.endDateTime})`);
        } else {
            if (!res.locals.params.endDateTime.includes(':')) {
                // convert '2020-03-19' to '2020-03-19T23:59:59.999Z'
                endDateTime.setDate(endDateTime.getDate() + 1);
                endDateTime.setTime(endDateTime.getTime() - 1);
            }
            res.locals.params.endDateTime = endDateTime.toISOString();
        }
    }
    if (errors.length) {
        throw new lumErrors.InvalidDataError(errors);
    }
    res.locals.paramsStr = JSON.stringify(res.locals.params);
    next();
};
/**
 * api to get asset-usage-tracking report from database
 * @param  {} req
 * @param  {} res
 * @param  {} next
 */
const getAssetUsageTracking = async (req, res, next) => {
    lumServer.logger.info(res, `api getAssetUsageTracking(${res.locals.paramsStr})`);
    res.locals.response.title = `asset-usage-tracking for software-licensor ${res.locals.params.softwareLicensorId}`;
    if (res.locals.params.startDateTime) {
        res.locals.response.title = `${res.locals.response.title} starting from ${res.locals.params.startDateTime}`;
    }
    if (res.locals.params.endDateTime) {
        res.locals.response.title = `${res.locals.response.title} up to ${res.locals.params.endDateTime}`;
    }

    Object.assign(res.locals.response, res.locals.params);

    res.locals.dbdata.assetUsageTracking = [];
    await pgclient.runTx(res, dbAssetUsage.getAssetUsageTracking);

    res.locals.response.stats = {
        assetUsages:{count:0,minDateTime:null,maxDateTime:null},
        assetUsageEvents:{count:0,minDateTime:null,maxDateTime:null}
    };
    res.locals.response.assetUsages = res.locals.dbdata.assetUsageTracking
        .filter(row =>row.assetUsageType === 'assetUsage')
        .map(row => {
            res.locals.response.stats.assetUsages.count += 1;
            const requested = row.response.requested;
            if (requested) {
                if (!res.locals.response.stats.assetUsages.minDateTime
                    || requested < res.locals.response.stats.assetUsages.minDateTime) {
                        res.locals.response.stats.assetUsages.minDateTime = requested;
                    }
                if (!res.locals.response.stats.assetUsages.maxDateTime
                    || requested > res.locals.response.stats.assetUsages.maxDateTime) {
                        res.locals.response.stats.assetUsages.maxDateTime = requested;
                    }
            }
            return row.response;
        });
    res.locals.response.assetUsageEvents = res.locals.dbdata.assetUsageTracking
        .filter(row =>row.assetUsageType === 'assetUsageEvent')
        .map(row => {
            res.locals.response.stats.assetUsageEvents.count += 1;
            const requested = row.response.requested;
            if (requested) {
                if (!res.locals.response.stats.assetUsageEvents.minDateTime
                    || requested < res.locals.response.stats.assetUsageEvents.minDateTime) {
                        res.locals.response.stats.assetUsageEvents.minDateTime = requested;
                    }
                if (!res.locals.response.stats.assetUsageEvents.maxDateTime
                    || requested > res.locals.response.stats.assetUsageEvents.maxDateTime) {
                        res.locals.response.stats.assetUsageEvents.maxDateTime = requested;
                    }
            }
            return row.response;
        });

    lumServer.logger.debug(res, `out api getAssetUsageTracking(${res.locals.paramsStr})`);
    next();
};

const Router = require('express-promise-router');
const router = new Router();

router.get('/software-licensor', validateParams, getAssetUsageTracking);

module.exports = router;
