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
const dbSwidTag = require('../../db/swid-tag');
const dbLicenseProfile = require('../../db/license-profile');

const setSwTagId = (req, res, next, swTagId) => {
    res.locals.params.swTagId = swTagId;
    res.set(res.locals.params);
    utils.logInfo(res, `:swTagId(${res.locals.params.swTagId})`);
    next();
};

const getSwidTag = async (req, res, next) => {
    utils.logInfo(res, `api getSwidTag(${res.locals.params.swTagId})`);
    res.locals.dbdata.swidTags = {};
    res.locals.dbdata.swidTags[res.locals.params.swTagId] = null;
    res.locals.dbdata.licenseProfiles = {};

    await pgclient.runTx(res, dbSwidTag.getSwidTag, dbLicenseProfile.getLicenseProfile);

    const swidTag = res.locals.dbdata.swidTags[res.locals.params.swTagId];
    if (!swidTag) {
        response.setHttpStatus(res, 204, "swidTag");
    } else if (swidTag.swidTagActive === false) {
        res.locals.response.swTagId = swidTag.swTagId;
        response.setHttpStatus(res, 224, "swidTag");
    } else {
        const licenseProfile = res.locals.dbdata.licenseProfiles[swidTag.licenseProfileId];
        if (!licenseProfile) {
            response.setHttpStatus(res, 204, "licenseProfile");
        } else {
            res.locals.response = Object.assign(res.locals.response, {"swidTag": swidTag});
            res.locals.response = Object.assign(res.locals.response, {"licenseProfile": licenseProfile});
        }
    }

    utils.logInfo(res, "out api getSwidTag", res.statusCode, response.getResHeader(res));
    next();
};

const revokeSwidTag = async (req, res, next) => {
    await pgclient.runTx(res, dbSwidTag.revokeSwidTag);
    next();
};

const putSwidTag = async (req, res, next) => {
    utils.logInfo(res, `api putSwidTag(${res.locals.params.swTagId})`);
    await pgclient.runTx(res, dbLicenseProfile.putLicenseProfile, dbSwidTag.putSwidTag);
    next();
};

// router
const Router = require('express-promise-router');
const router = new Router();

router.param('swTagId', setSwTagId);

router.route('/:swTagId')
    .get(getSwidTag)
    .delete(revokeSwidTag, getSwidTag)
    .put(putSwidTag, getSwidTag);

module.exports = {
     router: router,
     setSwTagId: setSwTagId,
     getSwidTag: getSwidTag
};
