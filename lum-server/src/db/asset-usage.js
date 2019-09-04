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

// const assetUsageKey = {"assetUsageId": true};
// {required: true, type: "array", ref: "swCategory"};
// const assetUsageReq = {
//     "isIncludedAsset": true
// };

// const assetUsageHouse = {
//     "assetUsageSeqTail"           : true,
//     "assetUsageSeqTailEntitled"   : true,
//     "assetUsageSeqTailEntitlement": true,
//     "assetUsageSeqTailEvent"      : true,
//     "creator"           : false,
//     "created"           : false,
//     "modifier"          : false,
//     "modified"          : false
// };
const assetUsageHistory = {
    "swMgtSystemId"        : true,
    "swMgtSystemInstanceId": true,
    "swMgtSystemComponent" : true
};
const swidTagHistory = {
    "softwareLicensorId": true,
    "swidTagRevision"   : true
};
const licenseProfileHistory = {
    "licenseProfileId"      : true,
    "licenseProfileRevision": true,
    "isRtuRequired"         : true
};

async function registerIncludedAssetUsage(res) {
    const assetUsage = res.locals.response.assetUsage;
    const includedAssetUsageIds = assetUsage.includedAssetUsage.map(iau => iau.includedAssetUsageId);
    if (!assetUsage.includedAssetUsage || !assetUsage.includedAssetUsage.length) {
        utils.logInfo(res, `skipped registerIncludedAssetUsage(${assetUsage.assetUsageId}) - nothing included`);
        return;
    }
    utils.logInfo(res, `in registerIncludedAssetUsage(${assetUsage.assetUsageId}) ${JSON.stringify(includedAssetUsageIds)}`);

    const keys = new SqlParams();
    keys.addParam("assetUsageId", assetUsage.assetUsageId);
    const includedKey = new SqlParams(keys.nextOffsetIdx);
    includedKey.setKeyValues("includedAssetUsageId", includedAssetUsageIds);
    const insFields = new SqlParams(includedKey.nextOffsetIdx);
    insFields.addParam("creator", res.locals.params.userId);

    const sqlCmd = `INSERT INTO "includedAssetUsage" (${keys.fields}, ${includedKey.keyName} ${insFields.fields})
            SELECT ${keys.idxValues}, UNNEST(ARRAY[${includedKey.idxKeyValues}]) ${insFields.idxValues}
            ON CONFLICT (${keys.fields}, ${includedKey.keyName}) DO NOTHING`;
    await pgclient.sqlQuery(res, sqlCmd, keys.values.concat(includedKey.values, insFields.values));

    utils.logInfo(res, `out registerIncludedAssetUsage(${assetUsage.assetUsageId})`);
}

async function storeAssetUsage(res, assetUsage) {
    const assetUsageId    = assetUsage.assetUsageId || assetUsage.includedAssetUsageId;
    const swTagId         = assetUsage.swTagId      || assetUsage.includedSwTagId;
    const isIncludedAsset = assetUsage.isIncludedAsset || !!assetUsage.includedAssetUsageId;
    utils.logInfo(res, `in storeAssetUsage(${assetUsageId})`);

    const keys = new SqlParams();
    keys.addParam("assetUsageId", assetUsageId);
    const usageFields = new SqlParams(keys.nextOffsetIdx);
    usageFields.addParam("isIncludedAsset", isIncludedAsset);
    usageFields.addParam("modifier", res.locals.params.userId);
    const insFields = new SqlParams(usageFields.nextOffsetIdx);
    insFields.addParam("creator", res.locals.params.userId);
    const historyFields = new SqlParams(insFields.nextOffsetIdx);
    historyFields.addParamsFromBody(assetUsageHistory, res.locals.reqBody);
    historyFields.addParam("usageEntitled", assetUsage.usageEntitled);
    historyFields.addParam("assetUsageReqId", res.locals.requestId);
    historyFields.addParam("action", res.locals.params.action);
    historyFields.addParam("assetUsageType", res.locals.params.assetUsageType);
    historyFields.addParam("swTagId", swTagId);
    historyFields.addParamsFromBody(swidTagHistory, assetUsage);
    historyFields.addParamsFromBody(licenseProfileHistory, assetUsage);

    const sqlCmd = `WITH asset_usage AS (
            INSERT INTO "assetUsage" AS au
            (${keys.fields} ${usageFields.fields} ${insFields.fields},
                "assetUsageSeqTail", "assetUsageSeqTailEntitlement", "created", "modified")
            VALUES (${keys.idxValues} ${usageFields.idxValues} ${insFields.idxValues},
                1, 1, NOW(), NOW())
            ON CONFLICT ("assetUsageId") DO UPDATE
            SET "assetUsageSeqTail" = au."assetUsageSeqTail" + 1,
                "assetUsageSeqTailEntitlement" = au."assetUsageSeqTail" + 1, "modified" = NOW()
                ${usageFields.updates}
            WHERE ${keys.getWhere("au")} RETURNING "assetUsageSeqTail")
        INSERT INTO "assetUsageHistory" AS auh
            (${keys.fields} ${historyFields.fields} ${insFields.fields}, "assetUsageSeq", "created")
            SELECT ${keys.idxValues} ${historyFields.idxValues} ${insFields.idxValues}, "assetUsageSeqTail", NOW() FROM asset_usage
        RETURNING auh."assetUsageSeq"`;
    const result = await pgclient.sqlQuery(res, sqlCmd,
        keys.values.concat(usageFields.values, insFields.values, historyFields.values));

    if (result.rows.length) {
        assetUsage.assetUsageSeq = result.rows[0].assetUsageSeq;
    }
    utils.logInfo(res, `out storeAssetUsage(${assetUsageId})`);
}

async function calcAssetUsageEntitlement(res, assetUsage) {
    const assetUsageId   = assetUsage.assetUsageId || assetUsage.includedAssetUsageId;
    const swTagId        = assetUsage.swTagId || assetUsage.includedSwTagId;
    const swidTag        = res.locals.dbdata.swidTags[swTagId] || {};
    const licenseProfile = res.locals.dbdata.licenseProfiles[swidTag.licenseProfileId] || {};

    utils.copyTo(assetUsage, swidTagHistory, swidTag);
    utils.copyTo(assetUsage, licenseProfileHistory, licenseProfile);

    if (assetUsage.isRtuRequired === false) {
        assetUsage.usageEntitled = true;
        utils.logInfo(res, `RTU not required - entitled calcAssetUsageEntitlement(${assetUsageId})`);
        return assetUsage.usageEntitled;
    }
    utils.logWarn(res, `TODO: RTU is required - implement calcAssetUsageEntitlement(${assetUsageId})`);
    assetUsage.usageEntitled = true;
    return assetUsage.usageEntitled;
}

async function incrementUsageCounter(res, assetUsage) {
    const assetUsageId  = assetUsage.assetUsageId || assetUsage.includedAssetUsageId;
    utils.logWarn(res, `TODO: implement incrementUsageCounter(${assetUsageId})`);
}

module.exports = {
    async getAssetUsage(res) {
        if (!response.isOk(res) || !res.locals.params.assetUsageId) {
            utils.logInfo(res, `skipped getAssetUsage(${res.locals.params.assetUsageId})`);
            return;
        }
        utils.logInfo(res, `in getAssetUsage(${res.locals.params.assetUsageId})`);

        const keys = new SqlParams();
        keys.addParam("assetUsageId", res.locals.params.assetUsageId);

        const sqlCmd = `SELECT aur."responseHttpCode", aur."response"
            FROM "assetUsageReq" AS aur, "assetUsage" AS au, "assetUsageHistory" AS auh
            WHERE ${keys.getWhere("au")} AND ${keys.getWhere("auh")}
              AND au."assetUsageSeqTailEntitlement" = auh."assetUsageSeq"
              AND auh."assetUsageReqId" = aur."assetUsageReqId"
            FOR SHARE`;

        const result = await pgclient.sqlQuery(res, sqlCmd, keys.values);
        if (result.rows.length) {
            res.locals.dbdata.assetUsage = result.rows[0];
        }
        utils.logInfo(res, `out getAssetUsage(${res.locals.params.assetUsageId})`);
    },
    async determineAssetUsageEntitlement(res) {
        const assetUsage = res.locals.response.assetUsage;
        if (!response.isOk(res) || !assetUsage.assetUsageId) {
            utils.logInfo(res, `skipped determineAssetUsageEntitlement(${assetUsage.assetUsageId})`);
            return;
        }
        utils.logInfo(res, `in determineAssetUsageEntitlement(${assetUsage.assetUsageId})`);

        res.locals.response.usageEntitled = await calcAssetUsageEntitlement(res, assetUsage);
        for await (const includedAssetUsage of assetUsage.includedAssetUsage || []) {
            const includedUsageEntitled = await calcAssetUsageEntitlement(res, includedAssetUsage);
            if (!includedUsageEntitled) {
                res.locals.response.usageEntitled = false;
            }
        }
        if (res.locals.response.usageEntitled) {
            await incrementUsageCounter(res, assetUsage);
            for await (const includedAssetUsage of assetUsage.includedAssetUsage || []) {
                await incrementUsageCounter(res, includedAssetUsage);
            }
        }


        utils.logInfo(res, `out determineAssetUsageEntitlement(${assetUsage.assetUsageId})`);
    },
    async putAssetUsage(res) {
        const assetUsage = res.locals.response.assetUsage;
        if (!response.isOk(res) || !assetUsage.assetUsageId) {
            utils.logInfo(res, `skipped putAssetUsage(${assetUsage.assetUsageId})`);
            return;
        }
        utils.logInfo(res, `in putAssetUsage(${assetUsage.assetUsageId})`);

        await storeAssetUsage(res, assetUsage);
        for await (const includedAssetUsage of assetUsage.includedAssetUsage || []) {
            await storeAssetUsage(res, includedAssetUsage);
        }
        await registerIncludedAssetUsage(res);

        utils.logInfo(res, `out putAssetUsage(${assetUsage.assetUsageId})`);
    },
    async getAssetUsageEvent(res) {
        if (!response.isOk(res) || !res.locals.params.assetUsageId) {
            utils.logInfo(res, `skipped getAssetUsageEvent(${res.locals.params.assetUsageId})`);
            return;
        }
        utils.logInfo(res, `in getAssetUsageEvent(${res.locals.params.assetUsageId})`);

        const keys = new SqlParams();
        keys.addParam("assetUsageId", res.locals.params.assetUsageId);

        const sqlCmd = `SELECT aur."responseHttpCode", aur."response"
            FROM "assetUsageReq" AS aur, "assetUsage" AS au, "assetUsageHistory" AS auh
            WHERE ${keys.getWhere("au")} AND ${keys.getWhere("auh")}
              AND au."assetUsageSeqTailEvent" = auh."assetUsageSeq"
              AND auh."assetUsageReqId" = aur."assetUsageReqId"
            FOR SHARE`;

        const result = await pgclient.sqlQuery(res, sqlCmd, keys.values);
        if (result.rows.length) {
            res.locals.dbdata.assetUsageEvent = result.rows[0];
        }
        utils.logInfo(res, `out getAssetUsageEvent(${res.locals.params.assetUsageId})`);
    },
    async putAssetUsageEvent(res) {
        if (!response.isOk(res) || !res.locals.params.assetUsageId) {
            utils.logInfo(res, `skipped putAssetUsageEvent(${res.locals.params.assetUsageId})`);
            return;
        }
        utils.logInfo(res, `in putAssetUsageEvent(${res.locals.params.assetUsageId})`);

        const swidTag = res.locals.dbdata.swidTags[res.locals.params.swTagId] || {};
        const licenseProfile = res.locals.dbdata.licenseProfiles[swidTag.licenseProfileId] || {};

        const keys = new SqlParams();
        keys.addParam("assetUsageId", res.locals.params.assetUsageId);
        const houseFields = new SqlParams(keys.nextOffsetIdx);
        houseFields.addParam("modifier", res.locals.params.userId);
        const insFields = new SqlParams(houseFields.nextOffsetIdx);
        insFields.addParam("creator", res.locals.params.userId);
        const historyFields = new SqlParams(insFields.nextOffsetIdx);
        historyFields.addParamsFromBody(assetUsageHistory, res.locals.reqBody);
        historyFields.addParam("assetUsageReqId", res.locals.requestId);
        historyFields.addParam("action", res.locals.params.action);
        historyFields.addParam("assetUsageType", res.locals.params.assetUsageType);
        historyFields.addParam("swTagId", res.locals.params.swTagId);
        historyFields.addParamsFromBody(swidTagHistory, swidTag);
        historyFields.addParamsFromBody(licenseProfileHistory, licenseProfile);

        const sqlCmd = `WITH asset_usage AS (
                INSERT INTO "assetUsage" AS au
                (${keys.fields} ${houseFields.fields} ${insFields.fields},
                    "assetUsageSeqTail", "assetUsageSeqTailEvent", "created", "modified")
                VALUES (${keys.idxValues} ${houseFields.idxValues} ${insFields.idxValues},
                    1, 1, NOW(), NOW())
                ON CONFLICT ("assetUsageId") DO UPDATE
                SET "assetUsageSeqTail" = au."assetUsageSeqTail" + 1,
                    "assetUsageSeqTailEvent" = au."assetUsageSeqTail" + 1, "modified" = NOW()
                    ${houseFields.updates}
                WHERE ${keys.getWhere("au")} RETURNING "assetUsageSeqTail")
            INSERT INTO "assetUsageHistory" AS auh
                (${keys.fields} ${historyFields.fields} ${insFields.fields}, "assetUsageSeq", "created")
                SELECT ${keys.idxValues} ${historyFields.idxValues} ${insFields.idxValues}, "assetUsageSeqTail", NOW() FROM asset_usage
            RETURNING auh."assetUsageSeq"`;
        const result = await pgclient.sqlQuery(res, sqlCmd,
            keys.values.concat(houseFields.values, insFields.values, historyFields.values));

        if (result.rows.length) {
            res.locals.response.assetUsageEvent.assetUsageSeq = result.rows[0].assetUsageSeq;
        }
        utils.copyTo(res.locals.response.assetUsageEvent, swidTagHistory, swidTag);
        utils.copyTo(res.locals.response.assetUsageEvent, licenseProfileHistory, licenseProfile);
        utils.logInfo(res, `out putAssetUsageEvent(${res.locals.params.assetUsageId})`);
    },
    async getAssetUsageTracking(res) {
        if (!response.isOk(res) || !res.locals.params.softwareLicensorId) {
            utils.logInfo(res, `skipped getAssetUsageTracking(${res.locals.params.softwareLicensorId})`);
            return;
        }
        utils.logInfo(res, `in getAssetUsageTracking(${res.locals.params.softwareLicensorId})`);

        const keys = new SqlParams();
        keys.addParam("softwareLicensorId", res.locals.params.softwareLicensorId);

        const sqlCmd = `WITH req_ids AS (SELECT DISTINCT auh."assetUsageReqId" FROM "assetUsageHistory" AS auh WHERE ${keys.getWhere("auh")})
            SELECT aur."assetUsageType", aur."response" FROM "assetUsageReq" AS aur, req_ids
            WHERE aur."assetUsageReqId" = req_ids."assetUsageReqId" ORDER BY aur."requestStarted", aur."assetUsageReqId"`;

        const result = await pgclient.sqlQuery(res, sqlCmd, keys.values);
        res.locals.dbdata.assetUsageTracking = result.rows;
        utils.logInfo(res, `out getAssetUsageTracking(${res.locals.params.softwareLicensorId})`);
    }
 };
