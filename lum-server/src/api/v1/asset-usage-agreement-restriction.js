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
const assetUsageAgreement = require('./asset-usage-agreement');
const dbAssetUsageAgreement = require('../../db/asset-usage-agreement');

const putAssetUsageAgreementRestriction = async (req, res, next) => {
    utils.logInfo(res, `api putAssetUsageAgreementRestriction(${res.locals.params.assetUsageAgreementId})`);
    await pgclient.runTx(res, dbAssetUsageAgreement.putAssetUsageAgreementRestriction);
    next();
};

const revokeAssetUsageAgreementRestriction = async (req, res, next) => {
    utils.logInfo(res, `api revokeAssetUsageAgreementRestriction(${res.locals.params.assetUsageAgreementId})`);
    await pgclient.runTx(res, dbAssetUsageAgreement.revokeAssetUsageAgreementRestriction);
    next();
};

// router
const Router = require('express-promise-router');
const router = new Router();

router.param('assetUsageAgreementId', assetUsageAgreement.setAssetUsageAgreementId);

router.route('/:assetUsageAgreementId')
    .delete(revokeAssetUsageAgreementRestriction, assetUsageAgreement.getAssetUsageAgreement)
    .put(putAssetUsageAgreementRestriction, assetUsageAgreement.getAssetUsageAgreement);

module.exports = router;
