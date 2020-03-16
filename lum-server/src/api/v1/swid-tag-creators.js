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
const swidTag = require('./swid-tag');
const dbSwidTag = require('../../db/swid-tag');
const dbLicenseProfile = require('../../db/license-profile');
/**
 * api to put swid-tag-creators on swidTag in database
 * @param  {} req
 * @param  {} res
 * @param  {} next
 */
const putSwidTagCreators = async (req, res, next) => {
    lumServer.logger.info(res, `api putSwidTagCreators(${res.locals.params.swTagId})`);
    await pgclient.runTx(res, dbLicenseProfile.activateLicenseProfile, dbSwidTag.putSwidTagCreators);
    next();
};

const Router = require('express-promise-router');
const router = new Router();

router.put('/', swidTag.validateParams, putSwidTagCreators, swidTag.getSwidTag);

module.exports = router;
