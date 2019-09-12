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
const dbAssetUsageReq = require('../../db/asset-usage-req');
const dbAssetUsage = require('../../db/asset-usage');
const dbSwidTag = require('../../db/swid-tag');
const dbLicenseProfile = require('../../db/license-profile');

/**
 * get assetUsageId from path and store in params
 * @param  {} req
 * @param  {} res
 * @param  {} next
 * @param  {string} assetUsageId
 */
const setAssetUsageId = (req, res, next, assetUsageId) => {
    res.locals.params.assetUsageId = assetUsageId;
    res.set(res.locals.params);
    utils.logInfo(res, `:assetUsageId(${res.locals.params.assetUsageId})`);
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
        response.setHttpStatus(res, 204, "assetUsage");
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
    res.locals.dbdata.licenseProfiles = {};

    const assetUsage = dbAssetUsage.convertToAssetUsage(res.locals.reqBody.assetUsageReq);
    res.locals.assetUsages[assetUsage.assetUsageId] = assetUsage;
    res.locals.dbdata.swidTags[assetUsage.swTagId] = null;

    for (const includedAssetUsage of res.locals.reqBody.assetUsageReq.includedAssetUsage || []) {
        res.locals.includedAssetUsageIds.push(includedAssetUsage.includedAssetUsageId);
        const assetUsage = dbAssetUsage.convertToAssetUsage(includedAssetUsage);
        res.locals.assetUsages[assetUsage.assetUsageId] = assetUsage;
        res.locals.dbdata.swidTags[assetUsage.swTagId] = null;
    }

    utils.logInfo(res, `api putAssetUsage(${res.locals.params.assetUsageId}, ${res.locals.params.action})`);
    await pgclient.runTx(res,
        dbAssetUsageReq.putAssetUsageReq,
        dbSwidTag.getSwidTag,
        dbLicenseProfile.getLicenseProfile,
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

    res.locals.response.assetUsage = dbAssetUsage.convertToAssetUsageResponse(res.locals.assetUsages[res.locals.params.assetUsageId]);

    for (const includedAssetUsage of res.locals.reqBody.assetUsageReq.includedAssetUsage || []) {
        if (!res.locals.response.assetUsage.includedAssetUsage) {
            res.locals.response.assetUsage.includedAssetUsage = [];
        }
        const assetUsage = dbAssetUsage.convertToAssetUsageResponse(res.locals.assetUsages[includedAssetUsage.includedAssetUsageId]);
        res.locals.response.assetUsage.includedAssetUsage.push(assetUsage);
    }
    utils.logInfo(res, `out api setAssetUsageResponse(${res.locals.params.assetUsageId}, ${res.locals.params.action})`);
};

// router
const Router = require('express-promise-router');
const router = new Router();

router.param('assetUsageId', setAssetUsageId);

router.route('/:assetUsageId')
    .get(getAssetUsage)
    .put(putAssetUsage);

module.exports = {
     router: router,
     setAssetUsageId: setAssetUsageId
};
