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
// const assetUsageReqFields = {
//     "swTagId":          true,
//     "assetUsageId":     true,
//     "action":           true,
//     "isIncludedAsset":  true
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
const assetUsageHistoryFields = {
    "swMgtSystemId"        : true,
    "swMgtSystemInstanceId": true,
    "swMgtSystemComponent" : true
};
const swidTagHistoryFields = {
    "softwareLicensorId": true,
    "swidTagRevision"   : true
};
const licenseProfileHistoryFields = {
    "licenseProfileId"      : true,
    "licenseProfileRevision": true,
    "isRtuRequired"         : true
};


async function storeAssetUsage(res, assetUsage) {
    utils.logInfo(res, `in storeAssetUsage(${assetUsage.assetUsageId})`);

    const keys = new SqlParams();
    keys.addField("assetUsageId", assetUsage.assetUsageId);
    const usageFields = new SqlParams(keys.nextOffsetIdx);
    usageFields.addField("isIncludedAsset", assetUsage.isIncludedAsset);
    usageFields.addField("modifier", res.locals.params.userId);
    const insFields = new SqlParams(usageFields.nextOffsetIdx);
    insFields.addField("creator", res.locals.params.userId);
    const historyFields = new SqlParams(insFields.nextOffsetIdx);
    historyFields.addFieldsFromBody(assetUsageHistoryFields, res.locals.reqBody);
    historyFields.addField("usageEntitled", assetUsage.usageEntitled);
    historyFields.addField("isSwCreator", assetUsage.isSwCreator);
    historyFields.addField("assetUsageReqId", res.locals.requestId);
    historyFields.addField("action", res.locals.params.action);
    historyFields.addField("assetUsageType", res.locals.params.assetUsageType);
    historyFields.addField("swTagId", assetUsage.swTagId);
    historyFields.addFieldsFromBody(swidTagHistoryFields, assetUsage);
    historyFields.addFieldsFromBody(licenseProfileHistoryFields, assetUsage);
    if (assetUsage.assetUsageDenial.length) {
        historyFields.addFieldJson("assetUsageDenial", assetUsage.assetUsageDenial);
    }

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
    utils.logInfo(res, `out storeAssetUsage(${assetUsage.assetUsageId})`);
}

/**
 * verify swidTag and licenseProfile are found for the asset-usage
 * @param  {} res
 * @param  {} assetUsage either assetUsage or includedAssetUsage
 */
async function verifyAssetUsageSwidTag(res, assetUsage) {
    const swidTag        = res.locals.dbdata.swidTags[assetUsage.swTagId];
    const licenseProfile = (swidTag && res.locals.dbdata.licenseProfiles[swidTag.licenseProfileId]) || null;

    utils.copyTo(assetUsage, swidTagHistoryFields, swidTag);
    utils.copyTo(assetUsage, licenseProfileHistoryFields, licenseProfile);
    assetUsage.isSwCreator = !!(swidTag && swidTag.swCreators && swidTag.swCreators.includes(res.locals.params.userId));

    if (!swidTag) {
        utils.addDenial(assetUsage.assetUsageDenial, "swidTagNotFound",
            `swid-tag not found for swTagId(${assetUsage.swTagId})`);
    } else if (!swidTag.swidTagActive) {
        utils.addDenial(assetUsage.assetUsageDenial, "swidTagRevoked",
            `swid-tag ${swidTag.closureReason || 'revoked'} for swTagId(${assetUsage.swTagId})`);
    }

    if (!licenseProfile) {
        utils.addDenial(assetUsage.assetUsageDenial, "licenseProfileNotFound",
            `license-profile not found
            for swTagId(${assetUsage.swTagId}) with licenseProfileId(${(swidTag || '').licenseProfileId || ''})`);
    } else if (!licenseProfile.licenseProfileActive) {
        utils.addDenial(assetUsage.assetUsageDenial, "licenseProfileRevoked",
            `license-profile ${licenseProfile.closureReason || 'revoked'}
            for swTagId(${assetUsage.swTagId}) with licenseProfileId(${(swidTag || '').licenseProfileId || ''})`);
    }
}

/**
 * find and check the RTU-permission for the assetUsage
 * @param  {} res
 * @param  {} assetUsage either assetUsage or includedAssetUsage
 */
async function checkRtu(res, assetUsage) {
    if (assetUsage.isRtuRequired === false) {
        utils.logInfo(res, `RTU not required - entitled checkRtu(${assetUsage.assetUsageId})`);
        return;
    }
    if (assetUsage.isSwCreator) {
        utils.logInfo(res, `RTU not required for software creator(${res.locals.params.userId}) -
            entitled checkRtu(${assetUsage.assetUsageId})`);
        return;
    }
    utils.logWarn(res, `TODO: RTU is required - implement checkRtu(${assetUsage.assetUsageId})`);
    utils.addDenial(assetUsage.assetUsageDenial, "agreementNotFound",
        `asset-usage-agreement not found for swTagId(${assetUsage.swTagId})`);
}

async function incrementUsageCounter(res, assetUsage) {
    utils.logWarn(res, `TODO: implement incrementUsageCounter(${assetUsage.assetUsageId})`);
}

module.exports = {
    /**
     * convert assetUsage or includedAssetUsage to shallow assetUsage object
     * with precursors for assetUsageDenial and entitlement
     * @param  {} assetUsage
     */
    convertToAssetUsage(assetUsage) {
        return {
            "swTagId":          (assetUsage.swTagId         || assetUsage.includedSwTagId),
            "assetUsageId":     (assetUsage.assetUsageId    || assetUsage.includedAssetUsageId),
            "action":           assetUsage.action,
            "isIncludedAsset":  (assetUsage.isIncludedAsset || !!assetUsage.includedAssetUsageId),
            "usageEntitled":            null,
            "isSwCreator":              null,
            "assetUsageSeq":            null,
            "swidTagRevision":          null,
            "licenseProfileId":         null,
            "licenseProfileRevision":   null,
            "isRtuRequired":            null,
            "softwareLicensorId":       null,
            "entitlement":              null,
            "assetUsageDenial":         [],
            "matchDenials":             []
        };
    },
    /**
     * remove the non-empty fields in assetUsage and rename fields when included
     * @param  {} assetUsage current assetUsage or includedAssetUsage
     */
    convertToAssetUsageResponse(assetUsage) {
        if (!assetUsage) {return assetUsage;}
        delete assetUsage.isIncludedAsset;
        delete assetUsage.matchDenials;
        for (const [key, value] of Object.entries(assetUsage)) {
            if (value == null) {
                delete assetUsage[key];
                continue;
            }
            if (key === "assetUsageDenial") {
                if (!assetUsage.assetUsageDenial.length) {
                    delete assetUsage.assetUsageDenial;
                    continue;
                }
            }
        }
        if (assetUsage.isIncludedAsset) {
            const includedAssetUsage = {
                "includedSwTagId": assetUsage.swTagId,
                "includedAssetUsageId": assetUsage.assetUsageId
            };
            delete assetUsage.assetUsageId;
            delete assetUsage.swTagId;
            return Object.assign(includedAssetUsage, assetUsage);
        }
        return assetUsage;
    },
    /**
     * GET the last assetUsage record from database
     * @param  {} res
     */
    async getAssetUsage(res) {
        if (!response.isOk(res) || !res.locals.params.assetUsageId) {
            utils.logInfo(res, `skipped getAssetUsage(${res.locals.params.assetUsageId})`);
            return;
        }
        utils.logInfo(res, `in getAssetUsage(${res.locals.params.assetUsageId})`);

        const keys = new SqlParams();
        keys.addField("assetUsageId", res.locals.params.assetUsageId);

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
    /**
     * main decision entry point to determine the asset-usage entitlement result
     * @param  {} res
     */
    async determineAssetUsageEntitlement(res) {
        if (!response.isOk(res) || !res.locals.params.assetUsageId) {
            utils.logInfo(res, `skipped determineAssetUsageEntitlement(${res.locals.params.assetUsageId})`);
            return;
        }
        utils.logInfo(res, `in determineAssetUsageEntitlement(${res.locals.params.assetUsageId})`);

        for await (const assetUsage of Object.values(res.locals.assetUsages)) {
            verifyAssetUsageSwidTag(res, assetUsage);
            await checkRtu(res, assetUsage);
            assetUsage.usageEntitled = !assetUsage.assetUsageDenial.length;

            if (res.locals.response.usageEntitled == null) {
                res.locals.response.usageEntitled = assetUsage.usageEntitled;
            } else if (!assetUsage.usageEntitled) {
                res.locals.response.usageEntitled = false;
            }
        }
        res.locals.response.usageEntitled = !!res.locals.response.usageEntitled;
        if (res.locals.response.usageEntitled) {
            for await (const assetUsage of Object.values(res.locals.assetUsages)) {
                await incrementUsageCounter(res, assetUsage);
            }
        }

        utils.logInfo(res, `out determineAssetUsageEntitlement(${res.locals.params.assetUsageId})`);
    },
    /**
     * INSERT assetUsage records into database
     * @param  {} res
     */
    async putAssetUsage(res) {
        if (!response.isOk(res) || !res.locals.params.assetUsageId) {
            utils.logInfo(res, `skipped putAssetUsage(${res.locals.params.assetUsageId})`);
            return;
        }
        utils.logInfo(res, `in putAssetUsage(${res.locals.params.assetUsageId})`);

        for await (const assetUsage of Object.values(res.locals.assetUsages)) {
            await storeAssetUsage(res, assetUsage);
        }

        utils.logInfo(res, `out putAssetUsage(${res.locals.params.assetUsageId})`);
    },
    /**
     * INSERT included asset-usage ids into includedAssetUsage table in database
     * @param  {} res
     */
    async registerIncludedAssetUsage(res) {
        if (!res.locals.includedAssetUsageIds.length) {
            utils.logInfo(res, `skipped registerIncludedAssetUsage(${res.locals.params.assetUsageId}) - nothing included`);
            return;
        }
        utils.logInfo(res, `in registerIncludedAssetUsage(${res.locals.params.assetUsageId}) ${JSON.stringify(res.locals.includedAssetUsageIds)}`);

        const keys = new SqlParams();
        keys.addField("assetUsageId", res.locals.params.assetUsageId);
        const includedKey = new SqlParams(keys.nextOffsetIdx);
        includedKey.setKeyValues("includedAssetUsageId", res.locals.includedAssetUsageIds);
        const insFields = new SqlParams(includedKey.nextOffsetIdx);
        insFields.addField("creator", res.locals.params.userId);

        const sqlCmd = `INSERT INTO "includedAssetUsage" (${keys.fields}, ${includedKey.keyName} ${insFields.fields})
                SELECT ${keys.idxValues}, UNNEST(ARRAY[${includedKey.idxKeyValues}]) ${insFields.idxValues}
                ON CONFLICT (${keys.fields}, ${includedKey.keyName}) DO NOTHING`;
        await pgclient.sqlQuery(res, sqlCmd, keys.values.concat(includedKey.values, insFields.values));

        utils.logInfo(res, `out registerIncludedAssetUsage(${res.locals.params.assetUsageId})`);
    },
    /**
     * GET the last assetUsageEvent record from database
     * @param  {} res
     */
    async getAssetUsageEvent(res) {
        if (!response.isOk(res) || !res.locals.params.assetUsageId) {
            utils.logInfo(res, `skipped getAssetUsageEvent(${res.locals.params.assetUsageId})`);
            return;
        }
        utils.logInfo(res, `in getAssetUsageEvent(${res.locals.params.assetUsageId})`);

        const keys = new SqlParams();
        keys.addField("assetUsageId", res.locals.params.assetUsageId);

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
    /**
     * INSERT the assetUsageReq record for the event into database
     * @param  {} res
     */
    async putAssetUsageEvent(res) {
        if (!response.isOk(res) || !res.locals.params.assetUsageId) {
            utils.logInfo(res, `skipped putAssetUsageEvent(${res.locals.params.assetUsageId})`);
            return;
        }
        utils.logInfo(res, `in putAssetUsageEvent(${res.locals.params.assetUsageId})`);

        const swidTag = res.locals.dbdata.swidTags[res.locals.params.swTagId] || {};
        const licenseProfile = res.locals.dbdata.licenseProfiles[swidTag.licenseProfileId] || {};

        const keys = new SqlParams();
        keys.addField("assetUsageId", res.locals.params.assetUsageId);
        const houseFields = new SqlParams(keys.nextOffsetIdx);
        houseFields.addField("modifier", res.locals.params.userId);
        const insFields = new SqlParams(houseFields.nextOffsetIdx);
        insFields.addField("creator", res.locals.params.userId);
        const historyFields = new SqlParams(insFields.nextOffsetIdx);
        historyFields.addFieldsFromBody(assetUsageHistoryFields, res.locals.reqBody);
        historyFields.addField("assetUsageReqId", res.locals.requestId);
        historyFields.addField("action", res.locals.params.action);
        historyFields.addField("assetUsageType", res.locals.params.assetUsageType);
        historyFields.addField("swTagId", res.locals.params.swTagId);
        historyFields.addFieldsFromBody(swidTagHistoryFields, swidTag);
        historyFields.addFieldsFromBody(licenseProfileHistoryFields, licenseProfile);

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
        utils.copyTo(res.locals.response.assetUsageEvent, swidTagHistoryFields, swidTag);
        utils.copyTo(res.locals.response.assetUsageEvent, licenseProfileHistoryFields, licenseProfile);
        utils.logInfo(res, `out putAssetUsageEvent(${res.locals.params.assetUsageId})`);
    },
    /**
     * GET assetUsageReq records per softwareLicensorId from the database
     * @param  {} res
     */
    async getAssetUsageTracking(res) {
        if (!response.isOk(res) || !res.locals.params.softwareLicensorId) {
            utils.logInfo(res, `skipped getAssetUsageTracking(${res.locals.params.softwareLicensorId})`);
            return;
        }
        utils.logInfo(res, `in getAssetUsageTracking(${res.locals.params.softwareLicensorId})`);

        const keys = new SqlParams();
        keys.addField("softwareLicensorId", res.locals.params.softwareLicensorId);

        const sqlCmd = `WITH req_ids AS (SELECT DISTINCT auh."assetUsageReqId" FROM "assetUsageHistory" AS auh WHERE ${keys.getWhere("auh")})
            SELECT aur."assetUsageType", aur."response" FROM "assetUsageReq" AS aur, req_ids
            WHERE aur."assetUsageReqId" = req_ids."assetUsageReqId" ORDER BY aur."requestStarted", aur."assetUsageReqId"`;

        const result = await pgclient.sqlQuery(res, sqlCmd, keys.values);
        res.locals.dbdata.assetUsageTracking = result.rows;
        utils.logInfo(res, `out getAssetUsageTracking(${res.locals.params.softwareLicensorId})`);
    }
 };
