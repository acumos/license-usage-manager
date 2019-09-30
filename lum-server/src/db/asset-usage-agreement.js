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
const pgclient = require('./pgclient');
const snapshot = require('./snapshot');
const SqlParams = require('./sql-params');
const odrl = require('./odrl');

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
const rightToUseFields = {
    "assetUsageRuleType" : true,
    "actions"            : false,
    "targetRefinement"   : false,
    "assigneeRefinement" : false,
    "usageConstraints"   : false,
    "consumedConstraints": false,
    "isPerpetual"        : false,
    "enableOn"           : false,
    "expireOn"           : false,
    "goodFor"            : false,
    "rightToUseActive"   : true,
    "closer"             : true,
    "closed"             : true,
    "closureReason"      : true
};
// const constraintKeys = {
//     "constraintScope": true,
//     "leftOperand"    : true,
//     "operator"       : true
// };
// const constraintDb = {
//     "rightOperand"   : true,
//     "dataType"       : true,
//     "unit"           : true
// };

/**
 * store rightToUse to the table in database
 * @param  {} res
 * @param  {} rightToUse single permission or prohibition
 */
async function storeRightToUse(res, rightToUse) {
    if (!res.locals.groomedAgreement || !rightToUse) {
        utils.logInfo(res, `skipped putRightToUse(${rightToUse.uid})`);
        return;
    }
    utils.logInfo(res, `in putRightToUse(${rightToUse.uid})`);

    const keys = new SqlParams();
    keys.addField("softwareLicensorId", res.locals.dbdata.assetUsageAgreement.softwareLicensorId);
    keys.addField("assetUsageAgreementId", res.locals.params.assetUsageAgreementId);
    keys.addField("rightToUseId", rightToUse.uid);
    const putFields = new SqlParams(keys);
    putFields.addFieldsFromBody(rightToUseFields, rightToUse);
    putFields.addField("rightToUseRevision", res.locals.dbdata.assetUsageAgreement.assetUsageAgreementRevision);
    const houseFields = new SqlParams(putFields);
    houseFields.addField("modifier", res.locals.params.userId);

    const insFields = new SqlParams(houseFields);
    insFields.addField("assetUsageRuleId", utils.uuid());
    insFields.addField("assigneeMetrics", rightToUse.assigneeMetrics);
    insFields.addField("metricsRevision", 0);
    insFields.addField("creator", res.locals.params.userId);

    const sqlCmd = `INSERT INTO "rightToUse" AS rtu
        (${keys.fields} ${putFields.fields} ${houseFields.fields} ${insFields.fields}, "created", "modified")
        VALUES (${keys.idxValues} ${putFields.idxValues} ${houseFields.idxValues} ${insFields.idxValues}, NOW(), NOW())
        ON CONFLICT (${keys.fields}) DO UPDATE
        SET "modified" = NOW() ${putFields.updates} ${houseFields.updates}
        WHERE rtu."rightToUseActive" = FALSE OR ${putFields.getWhereDistinct("rtu")}
        RETURNING *`;
    const result = await pgclient.sqlQuery(res, sqlCmd, keys.getAllValues());
    if (result.rows.length) {
        rightToUse = result.rows[0];
        await snapshot.storeSnapshot(res, rightToUse.softwareLicensorId,
            "rightToUse", rightToUse.assetUsageRuleId, rightToUse.rightToUseRevision, rightToUse);
    }
    utils.logInfo(res, `out putRightToUse(${rightToUse.uid} -> ${rightToUse.assetUsageRuleId})`);
}

module.exports = {
    async getAssetUsageAgreement(res) {
        utils.logInfo(res, `in getAssetUsageAgreement(${res.locals.params.assetUsageAgreementId})`);

        const keys = new SqlParams();
        keys.addField("assetUsageAgreementId", res.locals.params.assetUsageAgreementId);
        const selectFields = new SqlParams();
        selectFields.addFields(assetUsageAgreementReq);
        selectFields.addFields(agreementRestrictionReq);
        selectFields.addFields(agreementHouse);

        const sqlCmd = `SELECT ${keys.fields}, ${selectFields.fields} FROM "assetUsageAgreement" WHERE ${keys.where} FOR SHARE`;
        const result = await pgclient.sqlQuery(res, sqlCmd, keys.values);
        if (result.rows.length) {
            res.locals.dbdata.assetUsageAgreement = result.rows[0];
        }
        utils.logInfo(res, "out getAssetUsageAgreement");
    },
    async revokeAssetUsageAgreement(res) {
        utils.logInfo(res, `in revokeAssetUsageAgreement(${res.locals.params.assetUsageAgreementId})`);
        const keys = new SqlParams();
        keys.addField("assetUsageAgreementId", res.locals.params.assetUsageAgreementId);
        const putFields = new SqlParams(keys);
        putFields.addField("assetUsageAgreementActive", false);
        putFields.addField("closer", res.locals.params.userId);
        putFields.addField("closureReason", "revoked");

        const sqlCmd = `UPDATE "assetUsageAgreement"
            SET "assetUsageAgreementRevision" = "assetUsageAgreementRevision" + 1, "closed" = NOW()
            ${putFields.updates} WHERE ${keys.where} RETURNING *`;
        const result = await pgclient.sqlQuery(res, sqlCmd, keys.getAllValues());
        if (result.rows.length) {
            res.locals.dbdata.assetUsageAgreement = result.rows[0];
            await snapshot.storeSnapshot(res, res.locals.dbdata.assetUsageAgreement.softwareLicensorId,
                "assetUsageAgreement",
                res.locals.params.assetUsageAgreementId,
                res.locals.dbdata.assetUsageAgreement.assetUsageAgreementRevision,
                res.locals.dbdata.assetUsageAgreement
            );
            }
        utils.logInfo(res, `out revokeAssetUsageAgreement(${res.locals.params.assetUsageAgreementId})`);
    },
    /**
     * verify that all required properties are provided in request to PUT asset-usage-agreement
     * @param  {} res
     * @throws {InvalidDataError} when invalid data
     */
    validateAssetUsageAgreement(res) {
        utils.logInfo(res, `validateAssetUsageAgreement(${res.locals.params.assetUsageAgreementId})`);
        res.locals.assetUsageAgreement = utils.getFromReqByPath(res, "assetUsageAgreement") || {};
        odrl.validateAgreement(res.locals.assetUsageAgreement.agreement);
    },
    async putAssetUsageAgreement(res) {
        if (!res.locals.params.assetUsageAgreementId) {
            utils.logInfo(res, `skipped putAssetUsageAgreement(${res.locals.params.assetUsageAgreementId})`);
            return;
        }
        utils.logInfo(res, `in putAssetUsageAgreement(${res.locals.params.assetUsageAgreementId})`);

        const keys = new SqlParams();
        keys.addField("softwareLicensorId", res.locals.assetUsageAgreement.softwareLicensorId);
        keys.addField("assetUsageAgreementId", res.locals.params.assetUsageAgreementId);
        const putFields = new SqlParams(keys);
        putFields.addField("agreement", res.locals.assetUsageAgreement.agreement);
        const houseFields = new SqlParams(putFields);
        houseFields.addField("assetUsageAgreementActive", true);
        houseFields.addField("modifier", res.locals.params.userId);
        houseFields.addField("closer", null);
        houseFields.addField("closed", null);
        houseFields.addField("closureReason", null);

        const insFields = new SqlParams(houseFields);
        insFields.addField("creator", res.locals.params.userId);

        const sqlCmd = `INSERT INTO "assetUsageAgreement" AS aua
            (${keys.fields} ${putFields.fields} ${houseFields.fields} ${insFields.fields}, "created", "modified")
            VALUES (${keys.idxValues} ${putFields.idxValues} ${houseFields.idxValues} ${insFields.idxValues}, NOW(), NOW())
            ON CONFLICT (${keys.fields}) DO UPDATE
            SET "assetUsageAgreementRevision" = aua."assetUsageAgreementRevision" + 1 ${putFields.updates} ${houseFields.updates}, "modified" = NOW()
            WHERE aua."assetUsageAgreementActive" = FALSE OR ${putFields.getWhereDistinct("aua")}
            RETURNING *`;
        const result = await pgclient.sqlQuery(res, sqlCmd, keys.getAllValues());
        if (result.rows.length) {
            res.locals.dbdata.assetUsageAgreement = result.rows[0];
            await snapshot.storeSnapshot(res, res.locals.dbdata.assetUsageAgreement.softwareLicensorId,
                "assetUsageAgreement",
                res.locals.params.assetUsageAgreementId,
                res.locals.dbdata.assetUsageAgreement.assetUsageAgreementRevision,
                res.locals.dbdata.assetUsageAgreement
            );
        }
        utils.logInfo(res, `out putAssetUsageAgreement(${res.locals.params.assetUsageAgreementId})`);
    },
    async groomAssetUsageAgreement(res) {
        if (!res.locals.dbdata.assetUsageAgreement) {
            utils.logInfo(res, `skipped groomAssetUsageAgreement(${res.locals.params.assetUsageAgreementId})`);
            return;
        }
        utils.logInfo(res, `in groomAssetUsageAgreement(${res.locals.params.assetUsageAgreementId})`);
        res.locals.groomedAgreement = odrl.groomAgreement(res, res.locals.dbdata.assetUsageAgreement.agreement);

        const keys = new SqlParams();
        keys.addField("softwareLicensorId", res.locals.dbdata.assetUsageAgreement.softwareLicensorId);
        keys.addField("assetUsageAgreementId", res.locals.params.assetUsageAgreementId);
        const putFields = new SqlParams(keys);
        putFields.addField("groomedAgreement", res.locals.groomedAgreement);
        const houseFields = new SqlParams(putFields);
        houseFields.addField("modifier", res.locals.params.userId);

        // houseFields.addField("closer", null);
        // houseFields.addField("closed", null);
        // houseFields.addField("closureReason", null);

        const sqlCmd = `UPDATE "assetUsageAgreement" AS aua
            SET "assetUsageAgreementRevision" = aua."assetUsageAgreementRevision" + 1 ${putFields.updates} ${houseFields.updates}, "modified" = NOW()
            WHERE ${keys.getWhere("aua")} AND ${putFields.getWhereDistinct("aua")} RETURNING *`;
        const result = await pgclient.sqlQuery(res, sqlCmd, keys.getAllValues());
        if (result.rows.length) {
            res.locals.dbdata.assetUsageAgreement = result.rows[0];
            await snapshot.storeSnapshot(res, res.locals.dbdata.assetUsageAgreement.softwareLicensorId,
                "assetUsageAgreement",
                res.locals.params.assetUsageAgreementId,
                res.locals.dbdata.assetUsageAgreement.assetUsageAgreementRevision,
                res.locals.dbdata.assetUsageAgreement
            );
        }
        utils.logInfo(res, `out groomAssetUsageAgreement(${res.locals.params.assetUsageAgreementId})`);
    },
    /**
     * INSERT rightToUse records into database per agreement
     * @param  {} res
     */
    async putRightToUse(res) {
        if (!res.locals.params.assetUsageAgreementId
        || !res.locals.dbdata.assetUsageAgreement
        || !res.locals.dbdata.assetUsageAgreement.assetUsageAgreementRevision
        || !res.locals.groomedAgreement
        || (!res.locals.groomedAgreement.permission && !res.locals.groomedAgreement.prohibition)) {
            utils.logInfo(res, `skipped putRightToUse(${res.locals.params.assetUsageAgreementId})`);
            return;
        }
        utils.logInfo(res, `in putRightToUse(${res.locals.params.assetUsageAgreementId})`);

        for await (const rightToUse of res.locals.groomedAgreement.permission) {
            await storeRightToUse(res, rightToUse);
        }
        for await (const rightToUse of res.locals.groomedAgreement.prohibition) {
            await storeRightToUse(res, rightToUse);
        }

        utils.logInfo(res, `out putRightToUse(${res.locals.params.assetUsageAgreementId})`);
    },
    /**
     * mark rightToUse records as non-active if not in agreement
     * @param  {} res
     */
    async revokeObsoleteRightToUse(res) {
        if (!res.locals.params.assetUsageAgreementId
            || !res.locals.dbdata.assetUsageAgreement
            || !res.locals.dbdata.assetUsageAgreement.assetUsageAgreementRevision) {
                utils.logInfo(res, `skipped revokeObsoleteRightToUse(${res.locals.params.assetUsageAgreementId})`);
                return;
            }
            utils.logInfo(res, `in revokeObsoleteRightToUse(${res.locals.params.assetUsageAgreementId})`);

            const keys = new SqlParams();
            keys.addField("softwareLicensorId", res.locals.dbdata.assetUsageAgreement.softwareLicensorId);
            keys.addField("assetUsageAgreementId", res.locals.params.assetUsageAgreementId);
            keys.addField("rightToUseActive", true);
            const mismatchKeys = new SqlParams(keys);
            mismatchKeys.addField("rightToUseRevision", res.locals.dbdata.assetUsageAgreement.assetUsageAgreementRevision);
            const putFields = new SqlParams(mismatchKeys);
            putFields.addField("rightToUseActive", false);
            putFields.addField("closer", res.locals.params.userId);
            putFields.addField("closureReason", "revoked");

            const sqlCmd = `UPDATE "rightToUse"
                SET "rightToUseRevision" = "rightToUseRevision" + 1, "closed" = NOW() ${putFields.updates}
                WHERE ${keys.where} AND NOT (${mismatchKeys.where}) RETURNING *`;

            const result = await pgclient.sqlQuery(res, sqlCmd, keys.getAllValues());
            if (result.rows.length) {
                for await (const rightToUse of result.rows) {
                    await snapshot.storeSnapshot(res, rightToUse.softwareLicensorId,
                        "rightToUse", rightToUse.assetUsageRuleId, rightToUse.rightToUseRevision, rightToUse);
                }
            }
            utils.logInfo(res, `out revokeObsoleteRightToUse(${res.locals.params.assetUsageAgreementId})`);
    },
    async putAssetUsageAgreementRestriction(res) {
        if (!res.locals.params.assetUsageAgreementId) {
            utils.logInfo(res, `skipped putAssetUsageAgreementRestriction(${res.locals.params.assetUsageAgreementId})`);
            return;
        }
        utils.logInfo(res, `in putAssetUsageAgreementRestriction(${res.locals.params.assetUsageAgreementId})`);

        const keys = new SqlParams();
        keys.addField("assetUsageAgreementId", res.locals.params.assetUsageAgreementId);
        const putFields = new SqlParams(keys);
        putFields.addField("agreementRestriction", utils.getFromReqByPath(res, "assetUsageAgreement", "agreementRestriction"));
        const houseFields = new SqlParams(putFields);
        houseFields.addField("modifier", res.locals.params.userId);

        const sqlCmd = `UPDATE "assetUsageAgreement" AS aua
            SET "assetUsageAgreementRevision" = aua."assetUsageAgreementRevision" + 1 ${putFields.updates} ${houseFields.updates}, "modified" = NOW()
            WHERE ${keys.getWhere("aua")} AND ${putFields.getWhereDistinct("aua")} RETURNING *`;
        const result = await pgclient.sqlQuery(res, sqlCmd, keys.getAllValues());
        if (result.rows.length) {
            const snapshotBody = result.rows[0];
            await snapshot.storeSnapshot(res, snapshotBody.softwareLicensorId,
                "assetUsageAgreement", res.locals.params.assetUsageAgreementId,
                snapshotBody.assetUsageAgreementRevision, snapshotBody);
        }
        utils.logInfo(res, `out putAssetUsageAgreementRestriction(${res.locals.params.assetUsageAgreementId})`);
    },
    async revokeAssetUsageAgreementRestriction(res) {
        if (!res.locals.params.assetUsageAgreementId) {
            utils.logInfo(res, `skipped revokeAssetUsageAgreementRestriction(${res.locals.params.assetUsageAgreementId})`);
            return;
        }
        utils.logInfo(res, `in revokeAssetUsageAgreementRestriction(${res.locals.params.assetUsageAgreementId})`);

        const keys = new SqlParams();
        keys.addField("assetUsageAgreementId", res.locals.params.assetUsageAgreementId);
        const putFields = new SqlParams(keys);
        putFields.addField("agreementRestriction", null);
        const houseFields = new SqlParams(putFields);
        houseFields.addField("modifier", res.locals.params.userId);

        const sqlCmd = `UPDATE "assetUsageAgreement" AS aua
            SET "assetUsageAgreementRevision" = aua."assetUsageAgreementRevision" + 1 ${putFields.updates} ${houseFields.updates}, "modified" = NOW()
            WHERE ${keys.getWhere("aua")} AND ${putFields.getWhereDistinct("aua")}
            RETURNING *`;
        const result = await pgclient.sqlQuery(res, sqlCmd, keys.getAllValues());
        if (result.rows.length) {
            const snapshotBody = result.rows[0];
            await snapshot.storeSnapshot(res, snapshotBody.softwareLicensorId,
                "assetUsageAgreement", res.locals.params.assetUsageAgreementId,
                snapshotBody.assetUsageAgreementRevision, snapshotBody);
        }
        utils.logInfo(res, `out revokeAssetUsageAgreementRestriction(${res.locals.params.assetUsageAgreementId})`);
    }
 };
