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
const snapshot = require('./snapshot');
const SqlParams = require('./sql-params');

// const agreementKey = {"assetUsageAgreementId": true};
// {required: true, type: "array", ref: "swCategory"};
const assetUsageAgreementReq = {
    "softwareLicensorId" : true,
    "agreement": true
};
const agreementRestrictionReq = {
    "agreementRestriction" : true
};

const agreementHouse = {
    "assetUsageAgreementRevision" : false,
    "assetUsageAgreementActive"   : false,
    "creator"           : false,
    "created"           : false,
    "modifier"          : false,
    "modified"          : false,
    "closer"            : false,
    "closed"            : false,
    "closureReason"     : false
};

module.exports = {
    async getAssetUsageAgreement(res) {
        utils.logInfo(res, `in getAssetUsageAgreement(${res.locals.params.assetUsageAgreementId})`);

        const keys = new SqlParams();
        keys.addParam("assetUsageAgreementId", res.locals.params.assetUsageAgreementId);
        const selectFields = new SqlParams();
        selectFields.addParams(assetUsageAgreementReq);
        selectFields.addParams(agreementRestrictionReq);
        selectFields.addParams(agreementHouse);

        const sqlCmd = `SELECT ${keys.fields}, ${selectFields.fields} FROM "assetUsageAgreement" WHERE ${keys.where} FOR SHARE`;
        const result = await pgclient.sqlQuery(res, sqlCmd, keys.values);
        if (!result.rows.length) {
            response.setHttpStatus(res, 204, "assetUsageAgreement");
        } else {
            const row = result.rows[0];
            if (row.assetUsageAgreementActive === false) {
                res.locals.response.assetUsageAgreementId = res.locals.params.assetUsageAgreementId;
                response.setHttpStatus(res, 224, "assetUsageAgreement");
            } else {
                res.locals.response = Object.assign(res.locals.response, {"assetUsageAgreement": row});
            }
        }
        utils.logInfo(res, "out getAssetUsageAgreement", res.statusCode, response.getResHeader(res));
    },
    async revokeAssetUsageAgreement(res) {
        utils.logInfo(res, `in revokeAssetUsageAgreement(${res.locals.params.assetUsageAgreementId})`);
        const keys = new SqlParams();
        keys.addParam("assetUsageAgreementId", res.locals.params.assetUsageAgreementId);
        const putFields = new SqlParams(keys.nextOffsetIdx);
        putFields.addParam("closer", res.locals.params.userId);
        putFields.addParam("closureReason", "revoked");

        const sqlCmd = `UPDATE "assetUsageAgreement" SET "assetUsageAgreementRevision" = "assetUsageAgreementRevision" + 1,
            "assetUsageAgreementActive" = FALSE, "closed" = NOW() ${putFields.updates} WHERE ${keys.where} RETURNING *`;
        const result = await pgclient.sqlQuery(res, sqlCmd, keys.values.concat(putFields.values));
        if (result.rows.length) {
            const snapshotBody = result.rows[0];
            await snapshot.addSnapshot(res, "assetUsageAgreement", res.locals.params.assetUsageAgreementId,
                snapshotBody.assetUsageAgreementRevision, snapshotBody);
        }
        utils.logInfo(res, `out revokeAssetUsageAgreement(${res.locals.params.assetUsageAgreementId})`);
    },
    async putAssetUsageAgreement(res) {
        if (!response.isOk(res) || !res.locals.params.assetUsageAgreementId) {
            utils.logInfo(res, `skipped putAssetUsageAgreement(${res.locals.params.assetUsageAgreementId})`);
            return;
        }
        utils.logInfo(res, `in putAssetUsageAgreement(${res.locals.params.assetUsageAgreementId})`);

        const keys = new SqlParams();
        keys.addParam("assetUsageAgreementId", res.locals.params.assetUsageAgreementId);
        const putFields = new SqlParams(keys.nextOffsetIdx);
        putFields.addParamsFromBody(assetUsageAgreementReq, utils.getFromReqByPath(res, "assetUsageAgreement"));
        const houseFields = new SqlParams(putFields.nextOffsetIdx);
        houseFields.addParam("assetUsageAgreementActive", true);
        houseFields.addParam("modifier", res.locals.params.userId);
        houseFields.addParam("closer", null);
        houseFields.addParam("closed", null);
        houseFields.addParam("closureReason", null);

        const insFields = new SqlParams(houseFields.nextOffsetIdx);
        insFields.addParam("creator", res.locals.params.userId);

        const sqlCmd = `INSERT INTO "assetUsageAgreement" AS aua
            (${keys.fields} ${putFields.fields} ${houseFields.fields} ${insFields.fields}, "created", "modified")
            VALUES (${keys.idxValues} ${putFields.idxValues} ${houseFields.idxValues} ${insFields.idxValues}, NOW(), NOW())
            ON CONFLICT ("assetUsageAgreementId") DO UPDATE
            SET "assetUsageAgreementRevision" = aua."assetUsageAgreementRevision" + 1 ${putFields.updates} ${houseFields.updates}, "modified" = NOW()
            WHERE ${keys.getWhere("aua")} AND (aua."assetUsageAgreementActive" = FALSE OR ${putFields.getWhereDistinct("aua")})
            RETURNING *`;
        const result = await pgclient.sqlQuery(res, sqlCmd,
            keys.values.concat(putFields.values, houseFields.values, insFields.values));
        if (result.rows.length) {
            const snapshotBody = result.rows[0];
            await snapshot.addSnapshot(res, "assetUsageAgreement", res.locals.params.assetUsageAgreementId,
                snapshotBody.assetUsageAgreementRevision, snapshotBody);
        }
        utils.logInfo(res, `out putAssetUsageAgreement(${res.locals.params.assetUsageAgreementId})`);
    },
    async putAssetUsageAgreementRestriction(res) {
        if (!response.isOk(res) || !res.locals.params.assetUsageAgreementId) {
            utils.logInfo(res, `skipped putAssetUsageAgreementRestriction(${res.locals.params.assetUsageAgreementId})`);
            return;
        }
        utils.logInfo(res, `in putAssetUsageAgreementRestriction(${res.locals.params.assetUsageAgreementId})`);

        const keys = new SqlParams();
        keys.addParam("assetUsageAgreementId", res.locals.params.assetUsageAgreementId);
        const putFields = new SqlParams(keys.nextOffsetIdx);
        putFields.addParam("agreementRestriction", utils.getFromReqByPath(res, "assetUsageAgreement", "agreementRestriction"));
        const houseFields = new SqlParams(putFields.nextOffsetIdx);
        houseFields.addParam("modifier", res.locals.params.userId);

        const sqlCmd = `UPDATE "assetUsageAgreement" AS aua
            SET "assetUsageAgreementRevision" = aua."assetUsageAgreementRevision" + 1 ${putFields.updates} ${houseFields.updates}, "modified" = NOW()
            WHERE ${keys.getWhere("aua")} AND ${putFields.getWhereDistinct("aua")} RETURNING *`;
        const result = await pgclient.sqlQuery(res, sqlCmd, keys.values.concat(putFields.values, houseFields.values));
        if (result.rows.length) {
            const snapshotBody = result.rows[0];
            await snapshot.addSnapshot(res, "assetUsageAgreement", res.locals.params.assetUsageAgreementId,
                snapshotBody.assetUsageAgreementRevision, snapshotBody);
        }
        utils.logInfo(res, `out putAssetUsageAgreementRestriction(${res.locals.params.assetUsageAgreementId})`);
    },
    async revokeAssetUsageAgreementRestriction(res) {
        if (!response.isOk(res) || !res.locals.params.assetUsageAgreementId) {
            utils.logInfo(res, `skipped revokeAssetUsageAgreementRestriction(${res.locals.params.assetUsageAgreementId})`);
            return;
        }
        utils.logInfo(res, `in revokeAssetUsageAgreementRestriction(${res.locals.params.assetUsageAgreementId})`);

        const keys = new SqlParams();
        keys.addParam("assetUsageAgreementId", res.locals.params.assetUsageAgreementId);
        const putFields = new SqlParams(keys.nextOffsetIdx);
        putFields.addParam("agreementRestriction", null);
        const houseFields = new SqlParams(putFields.nextOffsetIdx);
        houseFields.addParam("modifier", res.locals.params.userId);

        const sqlCmd = `UPDATE "assetUsageAgreement" AS aua
            SET "assetUsageAgreementRevision" = aua."assetUsageAgreementRevision" + 1 ${putFields.updates} ${houseFields.updates}, "modified" = NOW()
            WHERE ${keys.getWhere("aua")} AND ${putFields.getWhereDistinct("aua")}
            RETURNING *`;
        const result = await pgclient.sqlQuery(res, sqlCmd, keys.values.concat(putFields.values, houseFields.values));
        if (result.rows.length) {
            const snapshotBody = result.rows[0];
            await snapshot.addSnapshot(res, "assetUsageAgreement", res.locals.params.assetUsageAgreementId,
                snapshotBody.assetUsageAgreementRevision, snapshotBody);
        }
        utils.logInfo(res, `out revokeAssetUsageAgreementRestriction(${res.locals.params.assetUsageAgreementId})`);
    }
 };
