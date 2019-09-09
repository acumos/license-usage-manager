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
const pgclient = require('../../db/pgclient');
const dbAssetUsageAgreement = require('../../db/asset-usage-agreement');

const setAssetUsageAgreementId = (req, res, next, assetUsageAgreementId) => {
    res.locals.params.assetUsageAgreementId = assetUsageAgreementId;
    res.set(res.locals.params);
    utils.logInfo(res, `:assetUsageAgreementId(${res.locals.params.assetUsageAgreementId})`);
    if (next) {next();}
};

const getAssetUsageAgreement = async (req, res, next) => {
    utils.logInfo(res, `api getAssetUsageAgreement(${res.locals.params.assetUsageAgreementId})`);
    await pgclient.runTx(res, dbAssetUsageAgreement.getAssetUsageAgreement);
    next();
};

const revokeAssetUsageAgreement = async (req, res, next) => {
    await pgclient.runTx(res, dbAssetUsageAgreement.revokeAssetUsageAgreement);
    next();
};

const putAssetUsageAgreement = async (req, res, next) => {
    utils.logInfo(res, `api putAssetUsageAgreement(${res.locals.params.assetUsageAgreementId})`);
    await pgclient.runTx(res, dbAssetUsageAgreement.putAssetUsageAgreement);
    next();
};

// router
const Router = require('express-promise-router');
const router = new Router();

router.param('assetUsageAgreementId', setAssetUsageAgreementId);

router.route('/:assetUsageAgreementId')
    .get(getAssetUsageAgreement)
    .delete(revokeAssetUsageAgreement, getAssetUsageAgreement)
    .put(putAssetUsageAgreement, getAssetUsageAgreement);

module.exports = {
     router: router,
     setAssetUsageAgreementId: setAssetUsageAgreementId,
     getAssetUsageAgreement: getAssetUsageAgreement
};
