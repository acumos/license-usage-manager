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
const dbAssetUsageAgreement = require('../../db/asset-usage-agreement');

const setAssetUsageAgreementId = (req, res, next, assetUsageAgreementId) => {
    res.locals.params.assetUsageAgreementId = assetUsageAgreementId;
    res.set(res.locals.params);
    utils.logInfo(res, `:assetUsageAgreementId(${res.locals.params.assetUsageAgreementId})`);
    if (next) {next();}
};

const getAssetUsageAgreement = async (req, res, next) => {
    utils.logInfo(res, `api getAssetUsageAgreement(${res.locals.params.assetUsageAgreementId})`);
    res.locals.dbdata.assetUsageAgreement = null;
    await pgclient.runTx(res, dbAssetUsageAgreement.getAssetUsageAgreement);

    if (!res.locals.dbdata.assetUsageAgreement) {
        response.setHttpStatus(res, response.lumHttpCodes.notFound, "assetUsageAgreement");
    } else {
        if (res.locals.dbdata.assetUsageAgreement.assetUsageAgreementActive === false) {
            res.locals.response.assetUsageAgreementId = res.locals.params.assetUsageAgreementId;
            response.setHttpStatus(res, response.lumHttpCodes.revoked, "assetUsageAgreement");
        } else {
            res.locals.response = Object.assign(res.locals.response, {"assetUsageAgreement": res.locals.dbdata.assetUsageAgreement});
        }
    }

    utils.logInfo(res, "out api getAssetUsageAgreement", res.statusCode, response.getResHeader(res));
    next();
};

const revokeAssetUsageAgreement = async (req, res, next) => {
    await pgclient.runTx(res,
        dbAssetUsageAgreement.revokeAssetUsageAgreement,
        dbAssetUsageAgreement.revokeObsoleteRightToUse
    );
    next();
};

const putAssetUsageAgreement = async (req, res, next) => {
    utils.logInfo(res, `api putAssetUsageAgreement(${res.locals.params.assetUsageAgreementId})`);
    await pgclient.runTx(res,
        dbAssetUsageAgreement.validateAssetUsageAgreement,
        dbAssetUsageAgreement.putAssetUsageAgreement,
        dbAssetUsageAgreement.groomAssetUsageAgreement,
        dbAssetUsageAgreement.putRightToUse,
        dbAssetUsageAgreement.revokeObsoleteRightToUse
    );
    next();
};

// router
const Router = require('express-promise-router');
const router = new Router();

router.param('assetUsageAgreementId', setAssetUsageAgreementId);

router.route('/')
    .get(getAssetUsageAgreement)
    .delete(revokeAssetUsageAgreement, getAssetUsageAgreement)
    .put(putAssetUsageAgreement, getAssetUsageAgreement);

module.exports = {
     router: router,
     setAssetUsageAgreementId: setAssetUsageAgreementId,
     getAssetUsageAgreement: getAssetUsageAgreement
};
