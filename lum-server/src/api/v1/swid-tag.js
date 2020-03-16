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
const dbSwidTag = require('../../db/swid-tag');
const dbLicenseProfile = require('../../db/license-profile');
const acuLogger = require('../../logger-acumos');

/**
 * validate params received in query
 * @param  {} req
 * @param  {} res
 * @param  {} next
 */
const validateParams = (req, res, next) => {
    response.validateParamInQuery(res, 'swTagId');
    next();
};
/**
 * api to get swid-tag from database
 * @param  {} req
 * @param  {} res
 * @param  {} next
 */
const getSwidTag = async (req, res, next) => {
    lumServer.logger.info(res, `api getSwidTag(${res.locals.paramKeys})`);
    res.locals.dbdata.swidTags = {};
    utils.addSwidTag(res.locals.dbdata.swidTags, res.locals.params.swTagId);
    res.locals.dbdata.licenseProfiles = {};

    await pgclient.runTx(res, dbSwidTag.getSwidTag, dbLicenseProfile.getLicenseProfile);

    const swidTag = (res.locals.dbdata.swidTags[res.locals.params.swTagId] || {}).swidTagBody;
    if (!swidTag) {
        response.setHttpStatus(res, response.lumHttpCodes.notFound, "swidTag");
    } else if (swidTag.swidTagActive === false) {
        res.locals.response.swTagId = swidTag.swTagId;
        response.setHttpStatus(res, response.lumHttpCodes.revoked, "swidTag");
    } else {
        const licenseProfile = res.locals.dbdata.licenseProfiles[swidTag.licenseProfileId];
        if (!licenseProfile) {
            response.setHttpStatus(res, response.lumHttpCodes.notFound, "licenseProfile");
        } else {
            res.locals.response.swidTag        = utils.deepCopyTo({}, swidTag);
            res.locals.response.licenseProfile = utils.deepCopyTo({}, licenseProfile);
        }
    }

    lumServer.logger.debug(res, "out api getSwidTag", res.statusCode, response.getResHeader(res));
    next();
};
/**
 * api to revoke swid-tag
 * @param  {} req
 * @param  {} res
 * @param  {} next
 */
const revokeSwidTag = async (req, res, next) => {
    lumServer.logger.info(res, `api revokeSwidTag(${res.locals.paramKeys})`);
    await pgclient.runTx(res, dbSwidTag.revokeSwidTag);
    next();
};
/**
 * api to put swid-tag into database
 * @param  {} req
 * @param  {} res
 * @param  {} next
 */
const putSwidTag = async (req, res, next) => {
    lumServer.logger.info(res, `api putSwidTag(${res.locals.paramKeys})`);
    await pgclient.runTx(res, dbLicenseProfile.putLicenseProfile, dbSwidTag.putSwidTag);
    next();
};

const Router = require('express-promise-router');
const router = new Router();

router.use(validateParams);
router.route('/')
    .get(getSwidTag)
    .delete(acuLogger.startLogForAcumos, revokeSwidTag, getSwidTag)
    .put(acuLogger.startLogForAcumos, putSwidTag, getSwidTag);

module.exports = {
     router: router,
     validateParams: validateParams,
     getSwidTag: getSwidTag
};
