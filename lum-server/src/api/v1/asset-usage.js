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
const dbAssetUsageReq = require('../../db/asset-usage-req');
const dbAssetUsage = require('../../db/asset-usage');

/**
 * validate params received in query
 * @param  {} req
 * @param  {} res
 * @param  {} next
 */
const validateParams = (req, res, next) => {
    response.validateParamInQuery(res, 'assetUsageId');
    next();
};

/**
 * api for GET the asset-usage result
 * @param  {} req
 * @param  {} res
 * @param  {} next
 */
const getAssetUsage = async (req, res, next) => {
    utils.logInfo(res, `api getAssetUsage(${res.locals.params.assetUsageId})`);
    res.locals.dbdata.assetUsage = null;
    await pgclient.runTx(res, dbAssetUsage.getAssetUsage);
    if (!res.locals.dbdata.assetUsage) {
        response.setHttpStatus(res, response.lumHttpCodes.notFound, "assetUsage");
    } else {
        res.locals.response = res.locals.dbdata.assetUsage.response;
        if (res.locals.dbdata.assetUsage.responseHttpCode) {
            response.setHttpStatus(res, res.locals.dbdata.assetUsage.responseHttpCode, "assetUsage");
        }
    }
    utils.logInfo(res, `out api getAssetUsage(${res.locals.params.assetUsageId})`);
    next();
};

/**
 * api to PUT the request for asset-usage
 * @param  {} req
 * @param  {} res
 * @param  {} next
 */
const putAssetUsage = async (req, res, next) => {
    res.locals.params.assetUsageType = "assetUsage";
    res.locals.response.usageEntitled = null;

    res.locals.params.action = res.locals.reqBody.assetUsageReq.action;

    res.locals.assetUsages = {};
    res.locals.includedAssetUsageIds = [];

    res.locals.dbdata.swidTags = {};

    const assetUsage = dbAssetUsage.convertToAssetUsage(res.locals.reqBody.assetUsageReq);
    res.locals.assetUsages[assetUsage.assetUsageId] = assetUsage;
    utils.addSwidTag(res.locals.dbdata.swidTags, assetUsage.swTagId, assetUsage.isIncludedAsset);

    for (const includedAssetUsage of res.locals.reqBody.assetUsageReq.includedAssetUsage || []) {
        res.locals.includedAssetUsageIds.push(includedAssetUsage.includedAssetUsageId);
        const assetUsage = dbAssetUsage.convertToAssetUsage(includedAssetUsage);
        res.locals.assetUsages[assetUsage.assetUsageId] = assetUsage;
        utils.addSwidTag(res.locals.dbdata.swidTags, assetUsage.swTagId, assetUsage.isIncludedAsset);
    }

    utils.logInfo(res, `api putAssetUsage(${res.locals.params.assetUsageId}, ${res.locals.params.action})`);
    await pgclient.runTx(res,
        dbAssetUsageReq.putAssetUsageReq,
        dbAssetUsage.determineAssetUsageEntitlement,
        dbAssetUsage.putAssetUsage,
        dbAssetUsage.registerIncludedAssetUsage,
        setAssetUsageResponse,
        dbAssetUsageReq.putAssetUsageResponse
        );
    next();
};

/**
 * copy the results of the assetUsage into response
 * @param  {} res
 */
const setAssetUsageResponse = (res) => {
    utils.logInfo(res, `api setAssetUsageResponse(${res.locals.params.assetUsageId}, ${res.locals.params.action})`);

    if (!res.locals.response.usageEntitled) {
        response.setHttpStatus(res, response.lumHttpCodes.denied, "assetUsage");
    }
    res.locals.response.assetUsage = dbAssetUsage.convertToAssetUsageResponse(res.locals.assetUsages[res.locals.params.assetUsageId]);

    for (const includedAssetUsage of res.locals.reqBody.assetUsageReq.includedAssetUsage || []) {
        if (!res.locals.response.assetUsage.includedAssetUsage) {
            res.locals.response.assetUsage.includedAssetUsage = [];
        }
        const assetUsage = dbAssetUsage.convertToAssetUsageResponse(res.locals.assetUsages[includedAssetUsage.includedAssetUsageId]);
        delete assetUsage.isIncludedAsset;
        res.locals.response.assetUsage.includedAssetUsage.push(assetUsage);
    }
    utils.logInfo(res, `out api setAssetUsageResponse(${res.locals.params.assetUsageId}, ${res.locals.params.action})`);
};

// router
const Router = require('express-promise-router');
const router = new Router();

router.use(validateParams);

router.route('/')
    .get(getAssetUsage)
    .put(putAssetUsage);

module.exports = {
     router: router,
     validateParams: validateParams
};
