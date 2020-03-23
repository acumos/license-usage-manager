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

const utils = require('../../utils');
const response = require('../response');
const pgclient = require('../../db/pgclient');
const assetUsage = require('./asset-usage');
const dbAssetUsageReq = require('../../db/asset-usage-req');
const dbAssetUsage = require('../../db/asset-usage');
const acuLogger = require('../../logger-acumos');

/**
 * api to get asset-usage-event from database
 * @param  {} req
 * @param  {} res
 * @param  {} next
 */
const getAssetUsageEvent = async (req, res, next) => {
    lumServer.logger.info(res, `api getAssetUsageEvent(${res.locals.paramsStr})`);
    res.locals.dbdata.assetUsageEvent = null;
    await pgclient.runTx(res, dbAssetUsage.getAssetUsageEvent);
    if (!res.locals.dbdata.assetUsageEvent) {
        response.setHttpStatus(res, response.lumHttpCodes.notFound, "assetUsageEvent");
    } else {
        res.locals.response = res.locals.dbdata.assetUsageEvent.response;
        if (res.locals.dbdata.assetUsageEvent.responseHttpCode) {
            response.setHttpStatus(res, res.locals.dbdata.assetUsageEvent.responseHttpCode, "assetUsageEvent");
        }
    }
    lumServer.logger.debug(res, `out api getAssetUsageEvent(${res.locals.paramsStr})`);
    next();
};
/**
 * api to put asset-usage-event into database
 * @param  {} req
 * @param  {} res
 * @param  {} next
 */
const putAssetUsageEvent = async (req, res, next) => {
    res.locals.params.assetUsageType = "assetUsageEvent";
    const assetUsageEvent = res.locals.reqBody.assetUsageEvent;
    res.locals.response.assetUsageEvent = utils.deepCopyTo({}, assetUsageEvent);

    res.locals.params.action = assetUsageEvent.action;
    res.locals.params.swTagId = assetUsageEvent.swTagId;
    res.locals.paramsStr = JSON.stringify(res.locals.params);

    lumServer.logger.info(res, `api putAssetUsageEvent(${res.locals.paramsStr})`);
    await pgclient.runTx(res,
        dbAssetUsageReq.putAssetUsageReq,
        dbAssetUsage.putAssetUsageEvent,
        dbAssetUsage.putAssetUsageEventMetrics,
        dbAssetUsageReq.putAssetUsageResponse
        );
    next();
};

const Router = require('express-promise-router');
const router = new Router();

router.use(assetUsage.validateParams);
router.route('/')
    .get(getAssetUsageEvent)
    .put(acuLogger.startLogForAcumos, putAssetUsageEvent);

module.exports = router;
