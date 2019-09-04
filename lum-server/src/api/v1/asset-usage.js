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

const setAssetUsageId = (req, res, next, assetUsageId) => {
    res.locals.params.assetUsageId = assetUsageId;
    res.set(res.locals.params);
    utils.logInfo(res, `:assetUsageId(${res.locals.params.assetUsageId})`);
    next();
};

const getAssetUsage = async (req, res, next) => {
    utils.logInfo(res, `api getAssetUsage(${res.locals.params.assetUsageId})`);
    res.locals.dbdata.getAssetUsage = null;
    await pgclient.runTx(res, dbAssetUsage.getAssetUsage);
    if (!res.locals.dbdata.getAssetUsage) {
        response.setHttpStatus(res, 204, "getAssetUsage");
    } else {
        res.locals.response = res.locals.dbdata.getAssetUsage.response;
        if (res.locals.dbdata.getAssetUsage.responseHttpCode) {
            response.setHttpStatus(res, res.locals.dbdata.getAssetUsage.responseHttpCode, "getAssetUsage");
        }
    }
    utils.logInfo(res, `out api getAssetUsage(${res.locals.params.assetUsageId})`);
    next();
};

const putAssetUsage = async (req, res, next) => {
    res.locals.params.assetUsageType = "assetUsage";
    const assetUsageReq = res.locals.reqBody.assetUsageReq;
    res.locals.response.assetUsage = Object.assign({}, res.locals.reqBody.assetUsageReq);

    res.locals.params.action = assetUsageReq.action;
    res.locals.params.swTagId = assetUsageReq.swTagId;

    res.locals.dbdata.swidTags = {};
    res.locals.dbdata.licenseProfiles = {};
    res.locals.dbdata.swidTags[res.locals.params.swTagId] = null;
    for (const includedAssetUsage of assetUsageReq.includedAssetUsage || []) {
        if (includedAssetUsage.includedSwTagId) {
            res.locals.dbdata.swidTags[includedAssetUsage.includedSwTagId] = null;
        }
    }

    utils.logInfo(res, `api putAssetUsage(${res.locals.params.assetUsageId}, ${res.locals.params.action})`);
    await pgclient.runTx(res,
        dbAssetUsageReq.putAssetUsageReq,
        dbSwidTag.getSwidTag,
        dbLicenseProfile.getLicenseProfile,
        dbAssetUsage.determineAssetUsageEntitlement,
        dbAssetUsage.putAssetUsage,
        dbAssetUsageReq.putAssetUsageResponse
        );
    next();
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
