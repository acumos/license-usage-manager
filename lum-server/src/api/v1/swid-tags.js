// ================================================================================
// Copyright (c) 2020 AT&T Intellectual Property. All rights reserved.
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

const response = require('../response');
const dbSwidTag = require('../../db/swid-tag');
const dbAssetUsage = require('../../db/asset-usage');

/**
 * validate params received in query
 * @param  {} req
 * @param  {} res
 * @param  {} next
 */
const validateParams = (req, res, next) => {
    response.validateParamInQuery(res, 'userId', 'action');
    res.locals.response.action = res.locals.params.action;
    next();
};
/**
 * api to get active swid-tags from database
 * @param  {} req
 * @param  {} res
 * @param  {} next
 */
const getActiveSwidTags = async (req, res, next) => {
    lumServer.logger.info(res, `api getActiveSwidTags`);
    await dbSwidTag.getActiveSwidTags(res);
    next();
};
/**
 * api to get swid-tags with available-entitlement from database
 * @param  {} req
 * @param  {} res
 * @param  {} next
 */
const getSwidTagsWithAvailableEntitlement = async (req, res, next) => {
    lumServer.logger.info(res, `api getSwidTagsWithAvailableEntitlement(${res.locals.paramsStr})`);
    await dbAssetUsage.getSwidTagsWithAvailableEntitlement(res);
    next();
};

const Router = require('express-promise-router');
const router = new Router();

router.get('/', getActiveSwidTags);
router.get('/available-entitlement', validateParams, getSwidTagsWithAvailableEntitlement);

module.exports = router;
