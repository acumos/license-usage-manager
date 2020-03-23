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

const pgclient = require('../../db/pgclient');
const assetUsageAgreement = require('./asset-usage-agreement');
const dbAssetUsageAgreement = require('../../db/asset-usage-agreement');

/**
 * api for put asset-usage-agreement-restriction
 * @param  {} req
 * @param  {} res
 * @param  {} next
 */
const putAssetUsageAgreementRestriction = async (req, res, next) => {
    lumServer.logger.info(res, `api putAssetUsageAgreementRestriction(${res.locals.paramsStr})`);
    await pgclient.runTx(res,
        dbAssetUsageAgreement.validateAssetUsageAgreementRestriction,
        dbAssetUsageAgreement.putAssetUsageAgreementRestriction,
        dbAssetUsageAgreement.groomAssetUsageAgreement,
        dbAssetUsageAgreement.putRightToUse,
        dbAssetUsageAgreement.revokeObsoleteRightToUse
    );
    next();
};
/**
 * api for revoke asset-usage-agreement-restriction
 * @param  {} req
 * @param  {} res
 * @param  {} next
 */
const revokeAssetUsageAgreementRestriction = async (req, res, next) => {
    lumServer.logger.info(res, `api revokeAssetUsageAgreementRestriction(${res.locals.paramsStr})`);
    await pgclient.runTx(res,
        dbAssetUsageAgreement.revokeAssetUsageAgreementRestriction,
        dbAssetUsageAgreement.groomAssetUsageAgreement,
        dbAssetUsageAgreement.putRightToUse,
        dbAssetUsageAgreement.revokeObsoleteRightToUse
    );
    next();
};

const Router = require('express-promise-router');
const router = new Router();

router.use(assetUsageAgreement.validateParams);

router.route('/')
    .delete(revokeAssetUsageAgreementRestriction, assetUsageAgreement.getAssetUsageAgreement)
    .put(putAssetUsageAgreementRestriction, assetUsageAgreement.getAssetUsageAgreement);

module.exports = router;
