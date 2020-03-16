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

const utils = require('../../utils');
const response = require('../response');
const pgclient = require('../../db/pgclient');
const dbAssetUsage = require('../../db/asset-usage');
/**
 * validate params received in query
 * @param  {} req
 * @param  {} res
 * @param  {} next
 */
const validateParams = (req, res, next) => {
    response.validateParamInQuery(res, 'softwareLicensorId');
    next();
};
/**
 * api to get asset-usage-tracking report from database
 * @param  {} req
 * @param  {} res
 * @param  {} next
 */
const getAssetUsageTracking = async (req, res, next) => {
    lumServer.logger.info(res, `api getAssetUsageTracking(${res.locals.params.softwareLicensorId})`);
    res.locals.response.title = `asset-usage-tracking for software-licensor ${res.locals.params.softwareLicensorId}`;
    res.locals.response.asOf = new Date();
    res.locals.response.softwareLicensorId = res.locals.params.softwareLicensorId;

    res.locals.dbdata.assetUsageTracking = [];
    await pgclient.runTx(res, dbAssetUsage.getAssetUsageTracking);
    res.locals.response.assetUsages      = res.locals.dbdata.assetUsageTracking.filter(row =>row.assetUsageType === 'assetUsage'     ).map(row => row.response);
    res.locals.response.assetUsageEvents = res.locals.dbdata.assetUsageTracking.filter(row =>row.assetUsageType === 'assetUsageEvent').map(row => row.response);

    lumServer.logger.debug(res, `out api getAssetUsageTracking(${res.locals.params.softwareLicensorId})`);
    next();
};

const Router = require('express-promise-router');
const router = new Router();

router.get('/software-licensor', validateParams, getAssetUsageTracking);

module.exports = router;
