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
const odrl = require('./odrl');
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
const swidTagAttributes = {
    "softwareLicensorId": true,
    "swidTagRevision"   : true
};
const licenseProfileAttributes = {
    "licenseProfileId"      : true,
    "licenseProfileRevision": true,
    "isRtuRequired"         : true
};
const assetUsageHistoryRtuAttributes = {
    "assetUsageRuleId":             true,
    "rightToUseRevision":           true,
    "assetUsageAgreementId":        true,
    "assetUsageAgreementRevision":  true,
    "licenseKeys":                  true,
    "metrics":                      true,
    "assigneeMetrics":              true
};

/**
 * generate SQL CASE WHEN lines for all of the ODRL operators
 * @param  {string} operator on the constraint
 * @param  {string} lhv left hand value
 * @param  {string} rhv right hand value
 * @param  {string} dataType
 */
function genCasesByOperator(operator, lhv, rhv, dataType) {
    dataType = `::${dataType || 'TEXT'}`;
    return `COALESCE(CASE ${operator}
                     WHEN '${odrl.OPERATORS.lumIn}' THEN (${rhv})::JSONB ? (${lhv})::TEXT
                     WHEN '${odrl.OPERATORS.lt}' THEN (${lhv})${dataType} < (${rhv})${dataType}
                     WHEN '${odrl.OPERATORS.lteq}' THEN (${lhv})${dataType} <= (${rhv})${dataType}
                     WHEN '${odrl.OPERATORS.eq}' THEN (${lhv})${dataType} = (${rhv})${dataType}
                     WHEN '${odrl.OPERATORS.gteq}' THEN (${lhv})${dataType} >= (${rhv})${dataType}
                     WHEN '${odrl.OPERATORS.gt}' THEN (${lhv})${dataType} > (${rhv})${dataType}
                     ELSE FALSE END, FALSE)`;
}

/**
 * verify swidTag and licenseProfile are found for the asset-usage
 * @param  {} res
 * @param  {} swidTag
 * @returns {boolean} whether swidTag is found and active
 */
function verifySwidTag(res, swidTag) {
    const licenseProfile   = (swidTag.swidTagBody && res.locals.dbdata.licenseProfiles[swidTag.swidTagBody.licenseProfileId]) || null;
    const licenseProfileId = (swidTag.swidTagBody || {}).licenseProfileId || '';

    swidTag.isRtuRequired     = (licenseProfile || {}).isRtuRequired;
    swidTag.isUsedBySwCreator = !!(swidTag.swidTagBody && swidTag.swidTagBody.swCreators
        && swidTag.swidTagBody.swCreators.includes(res.locals.params.userId));

    if (!swidTag.swidTagBody) {
        utils.addDenial(swidTag.usageDenials, "swidTagNotFound",
            `swid-tag not found for swTagId(${swidTag.swTagId})`, res.locals.params.action);
    } else if (!swidTag.swidTagBody.swidTagActive) {
        utils.addDenial(swidTag.usageDenials, "swidTagRevoked",
            `swid-tag ${swidTag.swidTagBody.closureReason || 'revoked'} for swTagId(${swidTag.swTagId})`,
            res.locals.params.action);
    }

    if (!licenseProfile) {
        utils.addDenial(swidTag.usageDenials, "licenseProfileNotFound",
            `license-profile not found
            for swTagId(${swidTag.swTagId}) with licenseProfileId(${licenseProfileId})`, res.locals.params.action);
    } else if (!licenseProfile.licenseProfileActive) {
        utils.addDenial(swidTag.usageDenials, "licenseProfileRevoked",
            `license-profile ${licenseProfile.closureReason || 'revoked'}
            for swTagId(${swidTag.swTagId}) with licenseProfileId(${licenseProfileId})`, res.locals.params.action);
    }
    return !swidTag.usageDenials.length;
}

/**
 * find the RTU-permission or prohibition for the swidTag
 * @param  {} res
 * @param  {} swidTag for either assetUsage or includedAssetUsage
 */
async function findRtuForSwidTag(res, swidTag) {
    if (!swidTag.isRtuRequired || !swidTag.swidTagBody || !swidTag.swidTagBody.softwareLicensorId) {
        utils.logInfo(res, `skipped findRtuForSwidTag(${swidTag.swTagId})`);
        return;
    }
    utils.logInfo(res, `in findRtuForSwidTag(${swidTag.swTagId})`);

    const keys = new SqlParams();
    keys.addField("swTagId", swidTag.swTagId);
    keys.addField("softwareLicensorId", swidTag.swidTagBody.softwareLicensorId);
    const actionField = new SqlParams(keys);
    actionField.setKeyValues("action", res.locals.params.action === 'use' ? ['use']: [res.locals.params.action, 'use']);
    const userField = new SqlParams(actionField);
    userField.addField("userId", res.locals.params.userId);
    const reqUsageCountField = new SqlParams(userField);
    reqUsageCountField.addField("reqUsageCount", swidTag.usageMetrics.reqUsageCount);

    const sqlCmd = `WITH swtctlg AS (
        SELECT stag."swTagId", ARRAY_AGG(DISTINCT ctlg."swCatalogId") AS "swCatalogIds",
                               ARRAY_AGG(DISTINCT ctlg."swCatalogType") AS "swCatalogTypes"
          FROM (SELECT "swTagId", "swCatalogs" FROM "swidTag" WHERE ${keys.where}) AS stag
                       CROSS JOIN LATERAL JSONB_TO_RECORDSET(stag."swCatalogs")
                               AS ctlg("swCatalogId" TEXT, "swCatalogType" TEXT)
                 GROUP BY stag."swTagId")
        SELECT rtu."assetUsageRuleId", rtu."assetUsageAgreementId", agr."assetUsageAgreementRevision",
            rtu."rightToUseId", rtu."assetUsageRuleType", rtu."rightToUseRevision", rtu."metricsRevision",
            rtu."licenseKeys", "rtuAction", usmcs."metrics", rtu."assigneeMetrics",
            (rtu."assigneeMetrics"->'users')::JSONB ? ${userField.idxKeyValues} AS "isUserInAssigneeMetrics"
        FROM (SELECT * FROM "swidTag" WHERE ${keys.where}) AS swt
             JOIN "rightToUse" AS rtu ON (rtu."softwareLicensorId" = swt."softwareLicensorId")
             JOIN "assetUsageAgreement" AS agr ON (rtu."softwareLicensorId" = agr."softwareLicensorId"
                                               AND rtu."assetUsageAgreementId" = agr."assetUsageAgreementId")
             CROSS JOIN LATERAL JSONB_ARRAY_ELEMENTS_TEXT(ARRAY_TO_JSON(rtu."actions")::JSONB) AS "rtuAction"
             LEFT OUTER JOIN LATERAL (SELECT ums.* FROM "usageMetrics" AS ums
                                       WHERE ums."usageMetricsId" = rtu."assetUsageRuleId"
                                         AND ums."action" = "rtuAction"
                                         AND ums."usageType" = 'rightToUse') AS usmcs ON TRUE
             LEFT OUTER JOIN LATERAL (SELECT swtctlg."swCatalogIds", swtctlg."swCatalogTypes" FROM swtctlg
                                       WHERE swtctlg."swTagId" = swt."swTagId") AS ctlgs ON TRUE
        WHERE "rtuAction" IN (${actionField.idxKeyValues})
          AND swt."swidTagActive" = TRUE AND rtu."rightToUseActive" = TRUE
          AND (rtu."expireOn" IS NULL OR NOW()::DATE <= rtu."expireOn"::DATE)
          AND (rtu."enableOn" IS NULL OR NOW()::DATE >= rtu."enableOn"::DATE)
          AND (rtu."targetRefinement"#>'{lum:swPersistentId}' IS NULL
            OR ${genCasesByOperator(`rtu."targetRefinement"#>>'{lum:swPersistentId,operator}'`,
                    `swt."swPersistentId"`, `rtu."targetRefinement"#>'{lum:swPersistentId,rightOperand}'`, 'TEXT')})
          AND (rtu."targetRefinement"#>'{lum:swTagId}' IS NULL
            OR ${genCasesByOperator(`rtu."targetRefinement"#>>'{lum:swTagId,operator}'`,
                    `swt."swTagId"`, `rtu."targetRefinement"#>'{lum:swTagId,rightOperand}'`, 'TEXT')})
          AND (rtu."targetRefinement"#>'{lum:swProductName}' IS NULL
            OR ${genCasesByOperator(`rtu."targetRefinement"#>>'{lum:swProductName,operator}'`,
                    `swt."swProductName"`, `rtu."targetRefinement"#>'{lum:swProductName,rightOperand}'`, 'TEXT')})
          AND (rtu."targetRefinement"#>'{lum:swCategory}' IS NULL
            OR ${genCasesByOperator(`rtu."targetRefinement"#>>'{lum:swCategory,operator}'`,
                    `swt."swCategory"`, `rtu."targetRefinement"#>'{lum:swCategory,rightOperand}'`, 'TEXT')})
          AND (rtu."targetRefinement"#>'{lum:swCatalogId}' IS NULL
            OR COALESCE(rtu."targetRefinement"#>'{lum:swCatalogId,rightOperand}' ?| ctlgs."swCatalogIds", FALSE))
          AND (rtu."targetRefinement"#>'{lum:swCatalogType}' IS NULL
            OR COALESCE(rtu."targetRefinement"#>'{lum:swCatalogType,rightOperand}' ?| ctlgs."swCatalogTypes", FALSE))
          AND (rtu."assigneeRefinement"#>'{lum:countUniqueUsers}' IS NULL
            OR (rtu."assigneeMetrics"->'users')::JSONB ? ${userField.idxKeyValues}
            OR ${genCasesByOperator(`rtu."assigneeRefinement"#>>'{lum:countUniqueUsers,operator}'`,
                `COALESCE(JSONB_ARRAY_LENGTH((rtu."assigneeMetrics"->'users')::JSONB), 0) + 1`,
                `rtu."assigneeRefinement"#>'{lum:countUniqueUsers,rightOperand}'`, 'INTEGER')})
      AND ((rtu."assigneeRefinement"#>'{lum:users}') IS NULL
            OR ${genCasesByOperator(`rtu."assigneeRefinement"#>>'{lum:users,operator}'`,
                    `${userField.idxKeyValues}`, `rtu."assigneeRefinement"#>'{lum:users,rightOperand}'`, 'TEXT')})
      AND (rtu."usageConstraints"#>'{count}' IS NULL
            OR ${genCasesByOperator(`rtu."usageConstraints"#>>'{count,operator}'`,
                    `COALESCE((usmcs."metrics"#>'{count}')::INTEGER, 0) + ${reqUsageCountField.idxKeyValues}`,
                    `rtu."usageConstraints"#>'{count,rightOperand}'`, 'INTEGER')})
        ORDER BY NULLIF(rtu."assetUsageRuleType", 'prohibition') NULLS FIRST,
                 NULLIF("rtuAction", 'use') NULLS LAST,
                 rtu."created", rtu."assetUsageRuleId"
        LIMIT 1 FOR UPDATE OF rtu`;

    const result = await pgclient.sqlQuery(res, sqlCmd, keys.getAllValues());
    if (result.rows.length) {
        swidTag.rightToUse = result.rows[0];
        utils.logInfo(res, `RTU found for swTagId(${swidTag.swTagId})`, swidTag.rightToUse);
    }
    utils.logInfo(res, `out findRtuForSwidTag(${swidTag.swTagId})`);
}
/**
 * find and check the RTU-permission for the swidTag
 * @param  {} res
 * @param  {} swidTag found either in assetUsage or includedAssetUsage
 */
async function checkRtuForSwidTag(res, swidTag) {
    if (swidTag.isUsedBySwCreator) {
        swidTag.usageMetrics.usageType        = "bySwCreator";
        swidTag.usageMetrics.usageMetricsId   = swidTag.swTagId;
        swidTag.usageMetrics.assetUsageRuleId = null;
        utils.logInfo(res, `RTU not required for software creator checkRtuForSwidTag(${res.locals.params.userId}) -
            entitled checkRtuForSwidTag(${swidTag.swTagId})`);
        return;
    }
    if (swidTag.isRtuRequired === false) {
        swidTag.usageMetrics.usageType        = "freeToUse";
        swidTag.usageMetrics.usageMetricsId   = swidTag.swTagId;
        swidTag.usageMetrics.assetUsageRuleId = null;
        utils.logInfo(res, `RTU not required - entitled checkRtuForSwidTag(${swidTag.swTagId})`);
        return;
    }
    if (swidTag.isRtuRequired == null) {
        utils.logWarn(res, `no license profile -> not looking for RTU - checkRtuForSwidTag(${swidTag.swTagId})`);
        return;
    }
    swidTag.usageMetrics.usageType        = "rightToUse";
    swidTag.usageMetrics.usageMetricsId   = null;
    swidTag.usageMetrics.assetUsageRuleId = null;

    await findRtuForSwidTag(res, swidTag);

    if (swidTag.rightToUse == null) {
        const denialsCount = await collectDenialsForSwidTag(res, swidTag);
        if (!denialsCount) {
            utils.addDenial(swidTag.usageDenials, "agreementNotFound",
                `asset-usage-agreement not found for swTagId(${swidTag.swTagId})`, res.locals.params.action);
        }
        return;
    }
    if (swidTag.rightToUse.assetUsageRuleType === odrl.RULE_TYPES.prohibition) {
        utils.logInfo(res, `usageProhibited checkRtuForSwidTag(${swidTag.swTagId})`);
        utils.addDenial(swidTag.usageDenials, "usageProhibited",
            `asset-usage prohibited for swTagId(${swidTag.swTagId})`,
            swidTag.rightToUse.rtuAction,
            "action", res.locals.params.action,
            swidTag.rightToUse.assetUsageAgreementId,
            swidTag.rightToUse.assetUsageAgreementRevision,
            swidTag.rightToUse.rightToUseId,
            swidTag.rightToUse.rightToUseRevision,
            {action: swidTag.rightToUse.rtuAction}
        );
        return;
    }
    swidTag.usageMetrics.usageMetricsId   = swidTag.rightToUse.assetUsageRuleId;
    swidTag.usageMetrics.assetUsageRuleId = swidTag.rightToUse.assetUsageRuleId;
    swidTag.entitlement = {
        rightToUseId: swidTag.rightToUse.rightToUseId,
        rightToUseRevision: swidTag.rightToUse.rightToUseRevision,
        assetUsageAgreementId: swidTag.rightToUse.assetUsageAgreementId,
        assetUsageAgreementRevision: swidTag.rightToUse.assetUsageAgreementRevision,
        licenseKeys: swidTag.rightToUse.licenseKeys
    };
    utils.logInfo(res, `entitled checkRtuForSwidTag(${swidTag.swTagId})`, swidTag.entitlement);
}
/**
 * find the first 100 of RTU-permission or prohibition for the swidTag that are denied
 * and report them into swidTag.usageDenials.
 *
 * SQL query is based on findRtu with denials moved from WHERE into SELECT list
 * @param  {} res
 * @param  {} swidTag for either assetUsage or includedAssetUsage
 */
async function collectDenialsForSwidTag(res, swidTag) {
    if (!swidTag.isRtuRequired || !swidTag.swidTagBody || !swidTag.swidTagBody.softwareLicensorId) {
        utils.logInfo(res, `skipped collectDenialsForSwidTag(${swidTag.swTagId})`);
        return;
    }
    utils.logInfo(res, `in collectDenialsForSwidTag(${swidTag.swTagId})`);

    const keys = new SqlParams();
    keys.addField("swTagId", swidTag.swTagId);
    keys.addField("softwareLicensorId", swidTag.swidTagBody.softwareLicensorId);
    const actionField = new SqlParams(keys);
    actionField.setKeyValues("action", res.locals.params.action === 'use' ? ['use']: [res.locals.params.action, 'use']);
    const userField = new SqlParams(actionField);
    userField.addField("userId", res.locals.params.userId);
    const reqUsageCountField = new SqlParams(userField);
    reqUsageCountField.addField("reqUsageCount", swidTag.usageMetrics.reqUsageCount);

    const sqlCmd = `WITH swtctlg AS (
        SELECT stag."swTagId", ARRAY_AGG(DISTINCT ctlg."swCatalogId") AS "swCatalogIds",
                               ARRAY_AGG(DISTINCT ctlg."swCatalogType") AS "swCatalogTypes"
          FROM (SELECT "swTagId", "swCatalogs" FROM "swidTag" WHERE ${keys.where}) AS stag
                       CROSS JOIN LATERAL JSONB_TO_RECORDSET(stag."swCatalogs")
                               AS ctlg("swCatalogId" TEXT, "swCatalogType" TEXT)
                 GROUP BY stag."swTagId")
        SELECT
        JSON_BUILD_OBJECT(
            'denied', NOT rtu."rightToUseActive",
            'denialType', 'rightToUseRevoked',
            'denialReason', 'rightToUse ' || COALESCE(rtu."closureReason", 'revoked'),
            'deniedAction', "rtuAction",
            'deniedAssetUsageAgreementId', rtu."assetUsageAgreementId",
            'deniedAssetUsageAgreementRevision', agr."assetUsageAgreementRevision",
            'deniedRightToUseId', rtu."rightToUseId",
            'deniedRightToUseRevision', rtu."rightToUseRevision",
            'denialReqItemName', 'rightToUseActive',
            'denialReqItemValue', TRUE
        ) AS "denied_rightToUseRevoked",

        JSON_BUILD_OBJECT(
            'denied', NOT (rtu."expireOn" IS NULL OR NOW()::DATE <= rtu."expireOn"::DATE),
            'denialType', 'timingConstraint',
            'denialReason', 'rightToUse ' || COALESCE(rtu."closureReason", 'expired'),
            'deniedAction', "rtuAction",
            'deniedAssetUsageAgreementId', rtu."assetUsageAgreementId",
            'deniedAssetUsageAgreementRevision', agr."assetUsageAgreementRevision",
            'deniedRightToUseId', rtu."rightToUseId",
            'deniedRightToUseRevision', rtu."rightToUseRevision",
            'denialReqItemName', 'date',
            'denialReqItemValue', NOW()::DATE,
            'deniedConstraint', JSON_BUILD_OBJECT('expireOn', rtu."expireOn")
        ) AS "denied_expired",

        JSON_BUILD_OBJECT(
            'denied', NOT (rtu."enableOn" IS NULL OR NOW()::DATE >= rtu."enableOn"::DATE),
            'denialType', 'timingConstraint',
            'denialReason', 'rightToUse ' || COALESCE(rtu."closureReason", 'too soon'),
            'deniedAction', "rtuAction",
            'deniedAssetUsageAgreementId', rtu."assetUsageAgreementId",
            'deniedAssetUsageAgreementRevision', agr."assetUsageAgreementRevision",
            'deniedRightToUseId', rtu."rightToUseId",
            'deniedRightToUseRevision', rtu."rightToUseRevision",
            'denialReqItemName', 'date',
            'denialReqItemValue', NOW()::DATE,
            'deniedConstraint', JSON_BUILD_OBJECT('enableOn', rtu."enableOn")
        ) AS "denied_tooSoon",

        JSON_BUILD_OBJECT(
            'denied', NOT (rtu."targetRefinement"#>'{lum:swPersistentId}' IS NULL
                OR ${genCasesByOperator(`rtu."targetRefinement"#>>'{lum:swPersistentId,operator}'`,
                    `swt."swPersistentId"`, `rtu."targetRefinement"#>'{lum:swPersistentId,rightOperand}'`, 'TEXT')}),
            'denialType', 'matchingConstraintOnTarget',
            'denialReason', 'not targeted by the rightToUse',
            'deniedAction', "rtuAction",
            'deniedAssetUsageAgreementId', rtu."assetUsageAgreementId",
            'deniedAssetUsageAgreementRevision', agr."assetUsageAgreementRevision",
            'deniedRightToUseId', rtu."rightToUseId",
            'deniedRightToUseRevision', rtu."rightToUseRevision",
            'denialReqItemName', 'swPersistentId',
            'denialReqItemValue', swt."swPersistentId",
            'deniedConstraint', rtu."targetRefinement"#>'{lum:swPersistentId}'
        ) AS "denied_swPersistentId",

        JSON_BUILD_OBJECT(
            'denied', NOT (rtu."targetRefinement"#>'{lum:swTagId}' IS NULL
                OR ${genCasesByOperator(`rtu."targetRefinement"#>>'{lum:swTagId,operator}'`,
                    `swt."swTagId"`, `rtu."targetRefinement"#>'{lum:swTagId,rightOperand}'`, 'TEXT')}),
            'denialType', 'matchingConstraintOnTarget',
            'denialReason', 'not targeted by the rightToUse',
            'deniedAction', "rtuAction",
            'deniedAssetUsageAgreementId', rtu."assetUsageAgreementId",
            'deniedAssetUsageAgreementRevision', agr."assetUsageAgreementRevision",
            'deniedRightToUseId', rtu."rightToUseId",
            'deniedRightToUseRevision', rtu."rightToUseRevision",
            'denialReqItemName', 'swTagId',
            'denialReqItemValue', swt."swTagId",
            'deniedConstraint', rtu."targetRefinement"#>'{lum:swTagId}'
        ) AS "denied_swTagId",

        JSON_BUILD_OBJECT(
            'denied', NOT (rtu."targetRefinement"#>'{lum:swProductName}' IS NULL
                OR ${genCasesByOperator(`rtu."targetRefinement"#>>'{lum:swProductName,operator}'`,
                    `swt."swProductName"`, `rtu."targetRefinement"#>'{lum:swProductName,rightOperand}'`, 'TEXT')}),
            'denialType', 'matchingConstraintOnTarget',
            'denialReason', 'not targeted by the rightToUse',
            'deniedAction', "rtuAction",
            'deniedAssetUsageAgreementId', rtu."assetUsageAgreementId",
            'deniedAssetUsageAgreementRevision', agr."assetUsageAgreementRevision",
            'deniedRightToUseId', rtu."rightToUseId",
            'deniedRightToUseRevision', rtu."rightToUseRevision",
            'denialReqItemName', 'swProductName',
            'denialReqItemValue', swt."swProductName",
            'deniedConstraint', rtu."targetRefinement"#>'{lum:swProductName}'
        ) AS "denied_swProductName",

        JSON_BUILD_OBJECT(
            'denied', NOT (rtu."targetRefinement"#>'{lum:swCategory}' IS NULL
                OR ${genCasesByOperator(`rtu."targetRefinement"#>>'{lum:swCategory,operator}'`,
                    `swt."swCategory"`, `rtu."targetRefinement"#>'{lum:swCategory,rightOperand}'`, 'TEXT')}),
            'denialType', 'matchingConstraintOnTarget',
            'denialReason', 'not targeted by the rightToUse',
            'deniedAction', "rtuAction",
            'deniedAssetUsageAgreementId', rtu."assetUsageAgreementId",
            'deniedAssetUsageAgreementRevision', agr."assetUsageAgreementRevision",
            'deniedRightToUseId', rtu."rightToUseId",
            'deniedRightToUseRevision', rtu."rightToUseRevision",
            'denialReqItemName', 'swCategory',
            'denialReqItemValue', swt."swCategory",
            'deniedConstraint', rtu."targetRefinement"#>'{lum:swCategory}'
        ) AS "denied_swCategory",

        JSON_BUILD_OBJECT(
            'denied', NOT (rtu."targetRefinement"#>'{lum:swCatalogId}' IS NULL
                  OR COALESCE(rtu."targetRefinement"#>'{lum:swCatalogId,rightOperand}' ?| ctlgs."swCatalogIds", FALSE)),
            'denialType', 'matchingConstraintOnTarget',
            'denialReason', 'not targeted by the rightToUse',
            'deniedAction', "rtuAction",
            'deniedAssetUsageAgreementId', rtu."assetUsageAgreementId",
            'deniedAssetUsageAgreementRevision', agr."assetUsageAgreementRevision",
            'deniedRightToUseId', rtu."rightToUseId",
            'deniedRightToUseRevision', rtu."rightToUseRevision",
            'denialReqItemName', 'swCatalogId',
            'denialReqItemValue', ctlgs."swCatalogIds",
            'deniedConstraint', rtu."targetRefinement"#>'{lum:swCatalogId}'
         ) AS "denied_swCatalogId",

         JSON_BUILD_OBJECT(
            'denied', NOT (rtu."targetRefinement"#>'{lum:swCatalogType}' IS NULL
                  OR COALESCE(rtu."targetRefinement"#>'{lum:swCatalogType,rightOperand}' ?| ctlgs."swCatalogTypes", FALSE)),
            'denialType', 'matchingConstraintOnTarget',
            'denialReason', 'not targeted by the rightToUse',
            'deniedAction', "rtuAction",
            'deniedAssetUsageAgreementId', rtu."assetUsageAgreementId",
            'deniedAssetUsageAgreementRevision', agr."assetUsageAgreementRevision",
            'deniedRightToUseId', rtu."rightToUseId",
            'deniedRightToUseRevision', rtu."rightToUseRevision",
            'denialReqItemName', 'swCatalogType',
            'denialReqItemValue', ctlgs."swCatalogTypes",
            'deniedConstraint', rtu."targetRefinement"#>'{lum:swCatalogType}'
         ) AS "denied_swCatalogType",

        JSON_BUILD_OBJECT(
            'denied', NOT (rtu."assigneeRefinement"#>'{lum:countUniqueUsers}' IS NULL
                OR (rtu."assigneeMetrics"->'users')::JSONB ? ${userField.idxKeyValues}
                OR ${genCasesByOperator(`rtu."assigneeRefinement"#>>'{lum:countUniqueUsers,operator}'`,
                    `COALESCE(JSONB_ARRAY_LENGTH((rtu."assigneeMetrics"->'users')::JSONB), 0) + 1`,
                    `rtu."assigneeRefinement"#>'{lum:countUniqueUsers,rightOperand}'`, 'INTEGER')}),
            'denialType', 'matchingConstraintOnAssignee',
            'denialReason', 'too many users for the rightToUse',
            'deniedAction', "rtuAction",
            'deniedAssetUsageAgreementId', rtu."assetUsageAgreementId",
            'deniedAssetUsageAgreementRevision', agr."assetUsageAgreementRevision",
            'deniedRightToUseId', rtu."rightToUseId",
            'deniedRightToUseRevision', rtu."rightToUseRevision",
            'denialReqItemName', 'userId',
            'denialReqItemValue', ${userField.idxKeyValues},
            'deniedConstraint', rtu."assigneeRefinement"#>'{lum:countUniqueUsers}',
            'deniedMetrics', rtu."assigneeMetrics"
        ) AS "denied_countUniqueUsers",

        JSON_BUILD_OBJECT(
            'denied', NOT ((rtu."assigneeRefinement"#>'{lum:users}') IS NULL
                OR ${genCasesByOperator(`rtu."assigneeRefinement"#>>'{lum:users,operator}'`,
                    `${userField.idxKeyValues}`, `rtu."assigneeRefinement"#>'{lum:users,rightOperand}'`, 'TEXT')}),
            'denialType', 'matchingConstraintOnAssignee',
            'denialReason', 'user not in assignee list on the rightToUse',
            'deniedAction', "rtuAction",
            'deniedAssetUsageAgreementId', rtu."assetUsageAgreementId",
            'deniedAssetUsageAgreementRevision', agr."assetUsageAgreementRevision",
            'deniedRightToUseId', rtu."rightToUseId",
            'deniedRightToUseRevision', rtu."rightToUseRevision",
            'denialReqItemName', 'userId',
            'denialReqItemValue', ${userField.idxKeyValues},
            'deniedConstraint', rtu."assigneeRefinement"#>'{lum:users}'
        ) AS "denied_users",

        JSON_BUILD_OBJECT(
            'denied', NOT (rtu."usageConstraints"#>'{count}' IS NULL
                OR ${genCasesByOperator(`rtu."usageConstraints"#>>'{count,operator}'`,
                    `COALESCE((usmcs."metrics"#>'{count}')::INTEGER, 0) + ${reqUsageCountField.idxKeyValues}`,
                    `rtu."usageConstraints"#>'{count,rightOperand}'`, 'INTEGER')}),
            'denialType', 'usageConstraint',
            'denialReason', 'exceeding the usage count on the rightToUse',
            'deniedAction', "rtuAction",
            'deniedAssetUsageAgreementId', rtu."assetUsageAgreementId",
            'deniedAssetUsageAgreementRevision', agr."assetUsageAgreementRevision",
            'deniedRightToUseId', rtu."rightToUseId",
            'deniedRightToUseRevision', rtu."rightToUseRevision",
            'denialReqItemName', 'usageCount',
            'denialReqItemValue', ${reqUsageCountField.idxKeyValues},
            'deniedConstraint', rtu."usageConstraints"#>'{count}',
            'deniedMetrics', COALESCE((usmcs."metrics"#>'{count}')::INTEGER, 0)
        ) AS "denied_usageCount"
        FROM (SELECT * FROM "swidTag" WHERE ${keys.where}) AS swt
             JOIN "rightToUse" AS rtu ON (rtu."softwareLicensorId" = swt."softwareLicensorId")
             JOIN "assetUsageAgreement" AS agr ON (rtu."softwareLicensorId" = agr."softwareLicensorId"
                                               AND rtu."assetUsageAgreementId" = agr."assetUsageAgreementId")
             CROSS JOIN LATERAL JSONB_ARRAY_ELEMENTS_TEXT(ARRAY_TO_JSON(rtu."actions")::JSONB) AS "rtuAction"
             LEFT OUTER JOIN LATERAL (SELECT ums.* FROM "usageMetrics" AS ums
                                       WHERE ums."usageMetricsId" = rtu."assetUsageRuleId"
                                         AND ums."action" = "rtuAction"
                                         AND ums."usageType" = 'rightToUse') AS usmcs ON TRUE
             LEFT OUTER JOIN LATERAL (SELECT swtctlg."swCatalogIds", swtctlg."swCatalogTypes" FROM swtctlg
                                       WHERE swtctlg."swTagId" = swt."swTagId") AS ctlgs ON TRUE
          WHERE "rtuAction" IN (${actionField.idxKeyValues})
        ORDER BY CASE WHEN rtu."rightToUseActive"
                       AND (rtu."enableOn" IS NULL OR NOW()::DATE >= rtu."enableOn"::DATE)
                       AND (rtu."expireOn" IS NULL OR NOW()::DATE <= rtu."expireOn"::DATE)
                      THEN '0' ELSE '1' END,
                 NULLIF(rtu."assetUsageRuleType", 'prohibition') NULLS FIRST,
                 NULLIF("rtuAction", 'use') NULLS LAST,
                 rtu."created", rtu."assetUsageRuleId"
        LIMIT 100`;

    const result = await pgclient.sqlQuery(res, sqlCmd, keys.getAllValues());
    const visitedDenials = {};
    for (const deniedRightToUse of result.rows) {
        for (const denial of Object.values(deniedRightToUse)) {
            if (!denial.denied) {continue;}
            delete denial.denied;
            const visitedDenial = JSON.stringify(denial);
            if (visitedDenials[visitedDenial]) {continue;}
            visitedDenials[visitedDenial] = true;
            swidTag.usageDenials.push(denial);
        }
    }
    utils.logInfo(res, `out collectDenialsForSwidTag(${swidTag.swTagId})`);
    return Object.keys(visitedDenials).length;
}
/**
 * increment counters and record userId into usageMetrics table
 * @param  {} res
 * @param  {} swidTag
 */
async function incrementUsageMetrics(res, swidTag) {
    if (!swidTag.usageMetrics || !swidTag.usageMetrics.usageMetricsId) {
        utils.logInfo(res, `skipped incrementUsageMetrics(${swidTag.swTagId})`);
        return;
    }
    utils.logInfo(res, `in incrementUsageMetrics(${swidTag.swTagId})`);

    const keys = new SqlParams();
    keys.addField("usageMetricsId", swidTag.usageMetrics.usageMetricsId);
    keys.addField("usageType", swidTag.usageMetrics.usageType);
    const actionField = new SqlParams(keys);
    actionField.addField("action", res.locals.params.action);
    const userField = new SqlParams(actionField);
    userField.addField("userId", res.locals.params.userId);
    const reqUsageCountField = new SqlParams(userField);
    reqUsageCountField.addField("reqUsageCount", swidTag.usageMetrics.reqUsageCount);
    const houseFields = new SqlParams(reqUsageCountField);
    houseFields.addField("modifier", res.locals.params.userId);
    houseFields.addField("modifierRequestId", res.locals.requestId);

    const insFields = new SqlParams(houseFields);
    insFields.addField("swTagId", swidTag.swTagId);
    insFields.addField("assetUsageRuleId", swidTag.usageMetrics.assetUsageRuleId);
    insFields.addField("metrics", {count: swidTag.usageMetrics.reqUsageCount, users:[res.locals.params.userId]});
    insFields.addField("usageMetricsRevision", 1);
    insFields.addField("creator", res.locals.params.userId);
    insFields.addField("creatorRequestId", res.locals.requestId);

    const sqlCmd = `INSERT INTO "usageMetrics" AS ums
        (${keys.fields} ${actionField.fields} ${houseFields.fields} ${insFields.fields}, "created", "modified")
        VALUES (${keys.idxValues} ${actionField.idxValues} ${houseFields.idxValues} ${insFields.idxValues}, NOW(), NOW())
             ${res.locals.params.action == 'use' ? '':
             `, (${keys.idxValues}, 'use' ${houseFields.idxValues} ${insFields.idxValues}, NOW(), NOW())`}
        ON CONFLICT (${keys.fields} ${actionField.fields}) DO UPDATE
        SET "usageMetricsRevision" = ums."usageMetricsRevision" + 1, "modified" = NOW(),
            "metrics" = ums.metrics
                || JSONB_BUILD_OBJECT('count', ((ums.metrics->'count')::INTEGER + ${reqUsageCountField.idxKeyValues}))
                || CASE WHEN (ums.metrics->'users')::JSONB ? ${userField.idxKeyValues} THEN '{}'::JSONB
                   ELSE JSONB_BUILD_OBJECT('users', (ums.metrics->'users')::JSONB
                                                   || ('["' || ${userField.idxKeyValues} || '"]')::JSONB)
                END
            ${houseFields.updates}
        RETURNING *`;

    await pgclient.sqlQuery(res, sqlCmd, keys.getAllValues());
    utils.logInfo(res, `out incrementUsageMetrics(${swidTag.swTagId}`);
}
/**
 * add userId into assigneeMetrics field in rightToUse table
 * @param  {} res
 * @param  {} swidTag
 */
async function updateAssigneeMetrics(res, swidTag) {
    if (!swidTag.rightToUse || swidTag.rightToUse.isUserInAssigneeMetrics || !swidTag.usageMetrics.assetUsageRuleId) {
        utils.logInfo(res, `skipped updateAssigneeMetrics(${swidTag.swTagId})`, swidTag);
        return;
    }
    utils.logInfo(res, `in updateAssigneeMetrics(${swidTag.swTagId})`);

    const keys = new SqlParams();
    keys.addField("assetUsageRuleId", swidTag.usageMetrics.assetUsageRuleId);
    const userField = new SqlParams(keys);
    userField.addField("userId", res.locals.params.userId);
    const houseFields = new SqlParams(userField);
    houseFields.addField("metricsModifierReqId", res.locals.requestId);
    const requestIdField = new SqlParams(houseFields);
    requestIdField.addField("requestId", res.locals.requestId);

    const sqlCmd = `UPDATE "rightToUse" SET "metricsModified" = NOW(), "metricsRevision" = "metricsRevision" + 1,
            "assigneeMetrics" = "assigneeMetrics"
                || CASE WHEN ("assigneeMetrics"->'users')::JSONB ? ${userField.idxKeyValues} THEN '{}'::JSONB
                        ELSE JSONB_BUILD_OBJECT('users', ("assigneeMetrics"->'users')::JSONB
                                              || ('["' || ${userField.idxKeyValues} || '"]')::JSONB) END,
            "usageStartReqId" = COALESCE("usageStartReqId", ${requestIdField.idxKeyValues}),
            "usageStarted"    = COALESCE("usageStarted", NOW())
            ${houseFields.updates} WHERE ${keys.where}`;
    await pgclient.sqlQuery(res, sqlCmd, keys.getAllValues());
    utils.logInfo(res, `out updateAssigneeMetrics(${swidTag.swTagId}`);
}

/**
 * copy swidTag and licenseProfile usage into the assetUsage
 * @param  {} res
 * @param  {} assetUsage either assetUsage or includedAssetUsage
 */
function copySwidTagUsageToAssetUsage(res, assetUsage) {
    const swidTag        = res.locals.dbdata.swidTags[assetUsage.swTagId];
    const licenseProfile = (swidTag.swidTagBody && res.locals.dbdata.licenseProfiles[swidTag.swidTagBody.licenseProfileId]) || null;

    utils.copyTo(assetUsage, swidTagAttributes, swidTag.swidTagBody);
    utils.copyTo(assetUsage, licenseProfileAttributes, licenseProfile);
    assetUsage.isUsedBySwCreator = !!swidTag.isUsedBySwCreator;
    assetUsage.entitlement       = swidTag.entitlement;
    assetUsage.rightToUse        = swidTag.rightToUse;
    assetUsage.usageMetrics      = swidTag.usageMetrics;
    Array.prototype.push.apply(assetUsage.assetUsageDenial, swidTag.usageDenials);
}
/**
 * insert/update the assetUsage and assetUsageHistory records for the assetUsage
 * @param  {} res
 * @param  {} assetUsage
 */
async function storeAssetUsage(res, assetUsage) {
    utils.logInfo(res, `in storeAssetUsage(${assetUsage.assetUsageId})`);

    const keys = new SqlParams();
    keys.addField("assetUsageId", assetUsage.assetUsageId);
    const usageFields = new SqlParams(keys);
    usageFields.addField("isIncludedAsset", assetUsage.isIncludedAsset);
    usageFields.addField("modifier", res.locals.params.userId);
    const insFields = new SqlParams(usageFields);
    insFields.addField("creator", res.locals.params.userId);
    const historyFields = new SqlParams(insFields);
    historyFields.addFieldsFromBody(assetUsageHistoryFields, res.locals.reqBody);
    historyFields.addField("usageEntitled", assetUsage.usageEntitled);
    historyFields.addField("isUsedBySwCreator", assetUsage.isUsedBySwCreator);
    historyFields.addField("assetUsageReqId", res.locals.requestId);
    historyFields.addField("assetUsageType", res.locals.params.assetUsageType);
    historyFields.addField("action", res.locals.params.action);
    historyFields.addField("swTagId", assetUsage.swTagId);
    historyFields.addFieldsFromBody(swidTagAttributes, assetUsage);
    historyFields.addFieldsFromBody(licenseProfileAttributes, assetUsage);
    historyFields.addFieldsFromBody(assetUsageHistoryRtuAttributes, assetUsage.rightToUse || {});
    historyFields.addField("usageMetricsId", (assetUsage.usageMetrics || {}).usageMetricsId);
    if (assetUsage.assetUsageDenial.length) {
        historyFields.addFieldJson("assetUsageDenial", assetUsage.assetUsageDenial);
    }

    const sqlCmd = `WITH asset_usage AS (
            INSERT INTO "assetUsage" AS au
            (${keys.fields} ${usageFields.fields} ${insFields.fields},
                "assetUsageSeqTail", "assetUsageSeqTailEntitlement", "created", "modified")
            VALUES (${keys.idxValues} ${usageFields.idxValues} ${insFields.idxValues},
                1, 1, NOW(), NOW())
            ON CONFLICT (${keys.fields}) DO UPDATE
            SET "assetUsageSeqTail" = au."assetUsageSeqTail" + 1,
                "assetUsageSeqTailEntitlement" = au."assetUsageSeqTail" + 1, "modified" = NOW()
                ${usageFields.updates}
            RETURNING "assetUsageSeqTail")
        INSERT INTO "assetUsageHistory" AS auh
            (${keys.fields} ${historyFields.fields} ${insFields.fields}, "assetUsageSeq", "created")
            SELECT ${keys.idxValues} ${historyFields.idxValues} ${insFields.idxValues}, "assetUsageSeqTail", NOW() FROM asset_usage
        RETURNING auh."assetUsageSeq"`;
    const result = await pgclient.sqlQuery(res, sqlCmd, keys.getAllValues());

    if (result.rows.length) {
        assetUsage.assetUsageSeq = result.rows[0].assetUsageSeq;
    }
    utils.logInfo(res, `out storeAssetUsage(${assetUsage.assetUsageId})`);
}

module.exports = {
    /**
     * convert assetUsage or includedAssetUsage to shallow assetUsage object
     * with precursors for assetUsageDenial and entitlement
     * @param  {} assetUsage
     */
    convertToAssetUsage(assetUsage) {
        return {
            swTagId:                (assetUsage.swTagId         || assetUsage.includedSwTagId),
            assetUsageId:           (assetUsage.assetUsageId    || assetUsage.includedAssetUsageId),
            action:                 assetUsage.action,
            isIncludedAsset:        (assetUsage.isIncludedAsset || !!assetUsage.includedAssetUsageId),
            usageEntitled:          null,
            isUsedBySwCreator:      null,
            assetUsageSeq:          null,
            softwareLicensorId:     null,
            licenseProfileId:       null,
            licenseProfileRevision: null,
            isRtuRequired:          null,
            swidTagRevision:        null,
            entitlement:            null,
            assetUsageDenial:       [],
            rightToUse:             null,
            usageMetrics:           null
        };
    },
    /**
     * remove the non-empty fields in assetUsage and rename fields when included
     * @param  {} assetUsage current assetUsage or includedAssetUsage
     */
    convertToAssetUsageResponse(assetUsage) {
        if (!assetUsage) {return assetUsage;}
        delete assetUsage.rightToUse;
        delete assetUsage.usageMetrics;
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
            return utils.deepCopyTo(includedAssetUsage, assetUsage);
        }
        return assetUsage;
    },
    /**
     * GET the last assetUsage record from database
     * @param  {} res
     */
    async getAssetUsage(res) {
        if (!res.locals.params.assetUsageId) {
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
        if (!res.locals.params.assetUsageId) {
            utils.logInfo(res, `skipped determineAssetUsageEntitlement(${res.locals.params.assetUsageId})`);
            return;
        }
        utils.logInfo(res, `in determineAssetUsageEntitlement(${res.locals.params.assetUsageId})`);

        for await (const swidTag of Object.values(res.locals.dbdata.swidTags)) {
            if (verifySwidTag(res, swidTag)) {
                await checkRtuForSwidTag(res, swidTag);
            }
        }

        for await (const assetUsage of Object.values(res.locals.assetUsages)) {
            copySwidTagUsageToAssetUsage(res, assetUsage);
            assetUsage.usageEntitled = !assetUsage.assetUsageDenial.length;

            if (res.locals.response.usageEntitled == null) {
                res.locals.response.usageEntitled = assetUsage.usageEntitled;
            } else if (!assetUsage.usageEntitled) {
                res.locals.response.usageEntitled = false;
            }
        }
        res.locals.response.usageEntitled = !!res.locals.response.usageEntitled;
        if (res.locals.response.usageEntitled) {
            for await (const swidTag of Object.values(res.locals.dbdata.swidTags)) {
                await incrementUsageMetrics(res, swidTag);
                await updateAssigneeMetrics(res, swidTag);
            }
        }

        utils.logInfo(res, `out determineAssetUsageEntitlement(${res.locals.params.assetUsageId})`);
    },
    /**
     * insert assetUsage records into database
     * @param  {} res
     */
    async putAssetUsage(res) {
        if (!res.locals.params.assetUsageId) {
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
     * insert included asset-usage ids into includedAssetUsage table in database
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
        const includedKey = new SqlParams(keys);
        includedKey.setKeyValues("includedAssetUsageId", res.locals.includedAssetUsageIds);
        const insFields = new SqlParams(includedKey);
        insFields.addField("creator", res.locals.params.userId);
        insFields.addField("creatorRequestId", res.locals.requestId);

        const sqlCmd = `INSERT INTO "includedAssetUsage" (${keys.fields}, ${includedKey.keyName} ${insFields.fields})
                SELECT ${keys.idxValues}, UNNEST(ARRAY[${includedKey.idxKeyValues}]) ${insFields.idxValues}
                ON CONFLICT (${keys.fields}, ${includedKey.keyName}) DO NOTHING`;
        await pgclient.sqlQuery(res, sqlCmd, keys.getAllValues());

        utils.logInfo(res, `out registerIncludedAssetUsage(${res.locals.params.assetUsageId})`);
    },
    /**
     * get the last assetUsageEvent record from database
     * @param  {} res
     */
    async getAssetUsageEvent(res) {
        if (!res.locals.params.assetUsageId) {
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
     * insert the assetUsageReq record for the event into database
     * @param  {} res
     */
    async putAssetUsageEvent(res) {
        if (!res.locals.params.assetUsageId) {
            utils.logInfo(res, `skipped putAssetUsageEvent(${res.locals.params.assetUsageId})`);
            return;
        }
        utils.logInfo(res, `in putAssetUsageEvent(${res.locals.params.assetUsageId})`);

        const swidTag = res.locals.dbdata.swidTags[res.locals.params.swTagId].swidTagBody || {};
        const licenseProfile = res.locals.dbdata.licenseProfiles[swidTag.licenseProfileId] || {};

        const keys = new SqlParams();
        keys.addField("assetUsageId", res.locals.params.assetUsageId);
        const houseFields = new SqlParams(keys);
        houseFields.addField("modifier", res.locals.params.userId);
        const insFields = new SqlParams(houseFields);
        insFields.addField("creator", res.locals.params.userId);
        const historyFields = new SqlParams(insFields);
        historyFields.addFieldsFromBody(assetUsageHistoryFields, res.locals.reqBody);
        historyFields.addField("assetUsageReqId", res.locals.requestId);
        historyFields.addField("action", res.locals.params.action);
        historyFields.addField("assetUsageType", res.locals.params.assetUsageType);
        historyFields.addField("swTagId", res.locals.params.swTagId);
        historyFields.addFieldsFromBody(swidTagAttributes, swidTag);
        historyFields.addFieldsFromBody(licenseProfileAttributes, licenseProfile);

        const sqlCmd = `WITH asset_usage AS (
                INSERT INTO "assetUsage" AS au
                (${keys.fields} ${houseFields.fields} ${insFields.fields},
                    "assetUsageSeqTail", "assetUsageSeqTailEvent", "created", "modified")
                VALUES (${keys.idxValues} ${houseFields.idxValues} ${insFields.idxValues},
                    1, 1, NOW(), NOW())
                ON CONFLICT (${keys.fields}) DO UPDATE
                SET "assetUsageSeqTail" = au."assetUsageSeqTail" + 1,
                    "assetUsageSeqTailEvent" = au."assetUsageSeqTail" + 1, "modified" = NOW()
                    ${houseFields.updates}
                RETURNING "assetUsageSeqTail")
            INSERT INTO "assetUsageHistory" AS auh
                (${keys.fields} ${historyFields.fields} ${insFields.fields}, "assetUsageSeq", "created")
                SELECT ${keys.idxValues} ${historyFields.idxValues} ${insFields.idxValues}, "assetUsageSeqTail", NOW() FROM asset_usage
            RETURNING auh."assetUsageSeq"`;
        const result = await pgclient.sqlQuery(res, sqlCmd, keys.getAllValues());

        if (result.rows.length) {
            res.locals.response.assetUsageEvent.assetUsageSeq = result.rows[0].assetUsageSeq;
        }
        utils.copyTo(res.locals.response.assetUsageEvent, swidTagAttributes, swidTag);
        utils.copyTo(res.locals.response.assetUsageEvent, licenseProfileAttributes, licenseProfile);
        utils.logInfo(res, `out putAssetUsageEvent(${res.locals.params.assetUsageId})`);
    },
    /**
     * update the usageMetrics record for the event into database
     * @param  {} res
     */
    async putAssetUsageEventMetrics(res) {
        if (!res.locals.params.assetUsageId) {
            utils.logInfo(res, `skipped putAssetUsageEventMetrics(${res.locals.params.assetUsageId})`);
            return;
        }
        utils.logInfo(res, `in putAssetUsageEventMetrics(${res.locals.params.assetUsageId})`);

        const swidTag = {
            swTagId: res.locals.params.swTagId,
            usageMetrics: {usageMetricsId: res.locals.params.swTagId, usageType: "assetUsageEvent"}
        };
        await incrementUsageMetrics(res, swidTag);
        utils.logInfo(res, `out putAssetUsageEventMetrics(${res.locals.params.assetUsageId})`);
    },
    /**
     * get assetUsageReq records per softwareLicensorId from the database
     * @param  {} res
     */
    async getAssetUsageTracking(res) {
        if (!res.locals.params.softwareLicensorId) {
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
