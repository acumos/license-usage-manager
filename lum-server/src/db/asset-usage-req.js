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

const utils = require('../utils');
const response = require('../api/response');
const pgclient = require('./pgclient');
const SqlParams = require('./sql-params');

// const assetUsageReqKeys = {
//     "assetUsageReqId": true
// };
// const assetUsageReq = {
//     "action"        : true,
//     "assetUsageType": true,
//     "requestHttp"   : true,
//     "request"       : true
// };
// const assetUsageResponse = {
//     "responseHttpCode": true,
//     "response"        : true,
//     "usageEntitled"   : true
// };

// const assetUsageReqHouse = {
//     "status"        : true,
//     "requestStarted": true
// };
// const assetUsageResponseHouse = {
//     "status"      : true,
//     "requestDone" : true,
//     "responseSent": true
// };

module.exports = {
    async putAssetUsageReq(res) {
        if (!response.isOk(res)) {
            utils.logInfo(res, `skipped putAssetUsageReq(${res.locals.requestId})`);
            return;
        }
        utils.logInfo(res, `in putAssetUsageReq(${res.locals.requestId})`);

        const keys = new SqlParams();
        keys.addParam("assetUsageReqId", res.locals.requestId);
        const putFields = new SqlParams(keys.nextOffsetIdx);
        putFields.addParam("action", res.locals.params.action);
        putFields.addParam("assetUsageType", res.locals.params.assetUsageType);
        putFields.addParam("requestHttp", res.locals.requestHttp);
        putFields.addParam("request", res.locals.reqBody);
        putFields.addParam("status", "started");

        const sqlCmd = `INSERT INTO "assetUsageReq"
            (${keys.fields} ${putFields.fields}, "requestStarted")
            VALUES (${keys.idxValues} ${putFields.idxValues}, NOW())`;
        await pgclient.sqlQuery(res, sqlCmd, keys.values.concat(putFields.values));
        utils.logInfo(res, `out putAssetUsageReq(${res.locals.requestId})`);
    },
    async putAssetUsageResponse(res) {
        if (!response.isOk(res)) {
            utils.logInfo(res, `skipped putAssetUsageResponse(${res.locals.requestId})`);
            return;
        }
        utils.logInfo(res, `in putAssetUsageResponse(${res.locals.requestId})`);

        const keys = new SqlParams();
        keys.addParam("assetUsageReqId", res.locals.requestId);
        const putFields = new SqlParams(keys.nextOffsetIdx);
        putFields.addParam("responseHttpCode", res.statusCode);
        putFields.addParam("response", res.locals.response);
        putFields.addParam("usageEntitled", res.locals.response.usageEntitled);
        putFields.addParam("status", "responseSent");

        const sqlCmd = `UPDATE "assetUsageReq" AS aur
            SET "requestDone" = TRUE, "responseSent" = NOW() ${putFields.updates}
            WHERE ${keys.getWhere("aur")}`;

        await pgclient.sqlQuery(res, sqlCmd, keys.values.concat(putFields.values));
        utils.logInfo(res, `out putAssetUsageResponse(${res.locals.requestId})`);
    }
 };
