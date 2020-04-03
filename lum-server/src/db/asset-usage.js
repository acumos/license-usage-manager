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
    "softwareLicensorId"        : true,
    "swidTagRevision"           : true,
    "licenseProfileId"          : true,
    "licenseProfileRevision"    : true,
    "isRtuRequired"             : true,
    "isUsedBySwCreator"         : true,
    "assetUsageRuleId"          : true,
    "rightToUseRevision"        : true,
    "assetUsageAgreementId"     : true,
    "assetUsageAgreementRevision": true,
    "licenseKeys"               : true,
    "metrics"                   : true,
    "assigneeMetrics"           : true
};

const sqlRtuActiveAndTimingOK = `rtu."rightToUseActive" = TRUE
                            AND COALESCE(NOW()::DATE >= rtu."enableOn", TRUE)
                            AND COALESCE(NOW()::DATE <= rtu."expireOn", TRUE)
                            AND COALESCE(NOW() <= rtu."usageEnds", TRUE)`;

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
 * generate sql command to either find the RTU or select all swid-tags with available-entitlement
 * @param  {boolean} getSwidTagForUsage whether to retrieve
 *                   all swid-tags with available-entitlement (false)
 *                   or selected (true) swidTag
 * @param  {} keys
 * @param  {} actionField
 * @param  {} userField
 * @param  {} reqUsageCountField
 * @returns {string} sql command
 */
function genSqlToEntitle(getSwidTagForUsage, keys, actionField, userField, reqUsageCountField) {
    const sqlOptions = {};
    if (getSwidTagForUsage) {
        sqlOptions.forShare = `FOR SHARE`;
        sqlOptions.forUpdate = `FOR UPDATE`;
        sqlOptions.whereKeys = `WHERE ${keys.getWhere('swt')} FOR SHARE OF swt`;
        sqlOptions.distinctBySwidTag = ``;
        sqlOptions.limitFor = `LIMIT 1 FOR UPDATE OF rtu`;
        sqlOptions.selectFields = `"assetUsageRuleId", "assetUsageAgreementId", "assetUsageAgreementRevision",
                                   "rightToUseId", "assetUsageRuleType", "rightToUseRevision",
                                   "metricsRevision", "licenseKeys", "rtuAction",
                                   "metrics", "assigneeMetrics", "isUserInAssigneeMetrics", "denial",`;
        sqlOptions.entitlement = `"entitlement"`;
        sqlOptions.excludeDenials = ``;
        sqlOptions.orderBy = ``;
    } else {
        sqlOptions.forShare = ``;
        sqlOptions.forUpdate = ``;
        sqlOptions.whereKeys = ``;
        sqlOptions.distinctBySwidTag = 'DISTINCT ON (swid_tag."swTagId")';
        sqlOptions.limitFor = ``;
        sqlOptions.selectFields = ``;
        sqlOptions.entitlement = `"availableEntitlement"`;
        sqlOptions.excludeDenials = `WHERE swtags_ent."denial" IS NULL
                                       AND (swtags_ent.need_rtu = FALSE
                                         OR swtags_ent.rtu_sw_id IS NOT NULL)`;
        sqlOptions.orderBy = `ORDER BY swtags_ent."softwareLicensorId", swtags_ent."swTagId"`;
    }
    return `WITH sw_lp AS (
        SELECT swt.*,
               COALESCE(${userField.idxKeyValues} = ANY (swt."swCreators"), FALSE) AS "isUsedBySwCreator",
               lp."licenseProfileRevision", lp."licenseProfileActive", lp."closureReason" AS lp_closure_reason, lp."isRtuRequired",
               COALESCE(swt."swidTagActive" = TRUE
                    AND lp."licenseProfileActive" = TRUE
                    AND lp."isRtuRequired" = TRUE
                    AND COALESCE(${userField.idxKeyValues} = ANY (swt."swCreators"), FALSE) = FALSE, FALSE) AS need_rtu
          FROM "swidTag" AS swt
               LEFT OUTER JOIN LATERAL (SELECT l_p.* FROM "licenseProfile" AS l_p
                                         WHERE l_p."licenseProfileId" = swt."licenseProfileId"
                                         ${sqlOptions.forShare}) AS lp ON TRUE
         ${sqlOptions.whereKeys}
        )
      , swid_tag AS (
        SELECT sw_lp.*,
               CASE WHEN sw_lp."isUsedBySwCreator" = TRUE  THEN 'bySwCreator'
                    WHEN sw_lp."isRtuRequired"     = FALSE THEN 'freeToUse'
                    WHEN sw_lp.need_rtu            = TRUE  THEN 'rightToUse'
                    ELSE NULL END AS "usageType",
               CASE WHEN sw_lp."swidTagActive" = FALSE THEN
                        JSON_BUILD_OBJECT(
                            'denialCode', 'denied_due_swidTagRevoked',
                            'denialType', 'swidTagRevoked',
                            'denialReason', FORMAT('swid-tag(%s) %s', sw_lp."swTagId", COALESCE(sw_lp."closureReason", 'revoked')),
                            'deniedAction', ${actionField.idxFirstValue}::TEXT
                        )
                    WHEN sw_lp."licenseProfileRevision" IS NULL THEN
                        JSON_BUILD_OBJECT(
                            'denialCode', 'denied_due_licenseProfileNotFound',
                            'denialType', 'licenseProfileNotFound',
                            'denialReason', FORMAT('license-profile(%s) not found for swid-tag(%s)', sw_lp."licenseProfileId", sw_lp."swTagId"),
                            'deniedAction', ${actionField.idxFirstValue}::TEXT
                        )
                    WHEN sw_lp."licenseProfileActive" = FALSE THEN
                        JSON_BUILD_OBJECT(
                            'denialCode', 'denied_due_licenseProfileRevoked',
                            'denialType', 'licenseProfileRevoked',
                            'denialReason', FORMAT('license-profile(%s) %s for swid-tag(%s)', sw_lp."licenseProfileId",
                                COALESCE(sw_lp.lp_closure_reason, 'revoked'), sw_lp."swTagId"),
                            'deniedAction', ${actionField.idxFirstValue}::TEXT
                        )
                    ELSE NULL END AS "denial"
          FROM sw_lp
        )
      , swt_ctlg AS (
        SELECT stag."swTagId", ARRAY_AGG(DISTINCT ctlg."swCatalogId")   AS "swCatalogIds",
                               ARRAY_AGG(DISTINCT ctlg."swCatalogType") AS "swCatalogTypes"
          FROM (SELECT "swTagId", "swCatalogs" FROM swid_tag WHERE swid_tag.need_rtu = TRUE) AS stag
                CROSS JOIN LATERAL JSONB_TO_RECORDSET(stag."swCatalogs") AS ctlg("swCatalogId" TEXT, "swCatalogType" TEXT)
         GROUP BY stag."swTagId")
      , rtu_rule AS (
        SELECT ${sqlOptions.distinctBySwidTag}
               swid_tag."swTagId" AS rtu_sw_id,
               rtu."assetUsageRuleId", rtu."assetUsageAgreementId", agr."assetUsageAgreementRevision",
               rtu."rightToUseId", rtu."assetUsageRuleType", rtu."rightToUseRevision",
               rtu."metricsRevision", rtu."licenseKeys", "rtuAction",
               usmcs."metrics", rtu."assigneeMetrics",
               (rtu."assigneeMetrics"->'users')::JSONB ? ${userField.idxKeyValues} AS "isUserInAssigneeMetrics"
          FROM swid_tag
               JOIN "rightToUse" AS rtu ON (rtu."softwareLicensorId" = swid_tag."softwareLicensorId")
               JOIN "assetUsageAgreement" AS agr ON (rtu."softwareLicensorId" = agr."softwareLicensorId"
                                                 AND rtu."assetUsageAgreementId" = agr."assetUsageAgreementId")
               CROSS JOIN LATERAL JSON_ARRAY_ELEMENTS_TEXT(ARRAY_TO_JSON(rtu."actions")) AS "rtuAction"
               LEFT OUTER JOIN LATERAL (SELECT ums.* FROM "usageMetrics" AS ums
                                         WHERE ums."usageMetricsId" = rtu."assetUsageRuleId"
                                           AND ums."action" = "rtuAction"
                                           AND ums."usageType" = 'rightToUse'
                                         ${sqlOptions.forUpdate}) AS usmcs ON TRUE
               LEFT OUTER JOIN LATERAL (SELECT swt_ctlg."swCatalogIds", swt_ctlg."swCatalogTypes" FROM swt_ctlg
                                         WHERE swt_ctlg."swTagId" = swid_tag."swTagId") AS ctlgs ON TRUE
         WHERE "rtuAction" IN (${actionField.idxKeyValues})
           AND ${sqlRtuActiveAndTimingOK}
           AND (rtu."targetRefinement"#>'{lum:swPersistentId}' IS NULL
             OR ${genCasesByOperator(`rtu."targetRefinement"#>>'{lum:swPersistentId,operator}'`,
                 `swid_tag."swPersistentId"`, `rtu."targetRefinement"#>'{lum:swPersistentId,rightOperand}'`, 'TEXT')})
           AND (rtu."targetRefinement"#>'{lum:swTagId}' IS NULL
             OR ${genCasesByOperator(`rtu."targetRefinement"#>>'{lum:swTagId,operator}'`,
                 `swid_tag."swTagId"`, `rtu."targetRefinement"#>'{lum:swTagId,rightOperand}'`, 'TEXT')})
           AND (rtu."targetRefinement"#>'{lum:swProductName}' IS NULL
             OR ${genCasesByOperator(`rtu."targetRefinement"#>>'{lum:swProductName,operator}'`,
                 `swid_tag."swProductName"`, `rtu."targetRefinement"#>'{lum:swProductName,rightOperand}'`, 'TEXT')})
           AND (rtu."targetRefinement"#>'{lum:swCategory}' IS NULL
             OR ${genCasesByOperator(`rtu."targetRefinement"#>>'{lum:swCategory,operator}'`,
                 `swid_tag."swCategory"`, `rtu."targetRefinement"#>'{lum:swCategory,rightOperand}'`, 'TEXT')})
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
         ORDER BY swid_tag."swTagId",
                  NULLIF(rtu."assetUsageRuleType", 'prohibition') NULLS FIRST,
                  NULLIF("rtuAction", 'use') NULLS LAST,
                  rtu."created", rtu."assetUsageRuleId"
         ${sqlOptions.limitFor})
      , swid_tag_entitlement AS (
        SELECT swid_tag."softwareLicensorId", swid_tag."swTagId",
               swid_tag."swidTagRevision", swid_tag."swPersistentId", swid_tag."swVersion", swid_tag."swProductName",
               swid_tag."licenseProfileId", swid_tag."licenseProfileRevision",
               swid_tag."isUsedBySwCreator", swid_tag."isRtuRequired",
               swid_tag."usageType", swid_tag.need_rtu,
               CASE WHEN swid_tag."denial" IS NOT NULL THEN swid_tag."denial"
                    WHEN swid_tag.need_rtu = FALSE THEN NULL
                    WHEN rtu_rule."assetUsageRuleType" = 'prohibition' THEN
                        JSON_BUILD_OBJECT(
                            'denialCode', 'denied_due_usageProhibited',
                            'denialType', 'usageProhibited',
                            'denialReason', FORMAT('swid-tag(%s) has been found but asset-usage is prohibited by prohibition(%s) under asset-usage-agreement(%s) for action(%s)',
                                swid_tag."swTagId", rtu_rule."rightToUseId", rtu_rule."assetUsageAgreementId", rtu_rule."rtuAction"),
                            'deniedAction', rtu_rule."rtuAction",
                            'deniedAssetUsageAgreementId', rtu_rule."assetUsageAgreementId",
                            'deniedAssetUsageAgreementRevision', rtu_rule."assetUsageAgreementRevision",
                            'deniedRightToUseId', rtu_rule."rightToUseId",
                            'deniedRightToUseRevision', rtu_rule."rightToUseRevision",
                            'denialReqItemName', 'action',
                            'denialReqItemValue', ${actionField.idxFirstValue}::TEXT,
                            'deniedConstraint', JSON_BUILD_OBJECT('action', rtu_rule."rtuAction")
                        )
                    ELSE NULL END AS "denial",
                rtu_rule.*
              FROM swid_tag LEFT OUTER JOIN rtu_rule ON (swid_tag."swTagId" = rtu_rule.rtu_sw_id)
        )
        SELECT "softwareLicensorId", "swTagId", "swidTagRevision", "swPersistentId",
               "swVersion", "swProductName", "licenseProfileId", "licenseProfileRevision",
               "isUsedBySwCreator", "isRtuRequired",
               ${sqlOptions.selectFields}
               CASE WHEN "denial" IS NULL
                     AND swtags_ent.need_rtu = TRUE
                     AND swtags_ent.rtu_sw_id IS NOT NULL THEN
                        JSON_BUILD_OBJECT(
                            'rightToUseId', swtags_ent."rightToUseId",
                            'rightToUseRevision', swtags_ent."rightToUseRevision",
                            'assetUsageAgreementId', swtags_ent."assetUsageAgreementId",
                            'assetUsageAgreementRevision', swtags_ent."assetUsageAgreementRevision",
                            'licenseKeys', swtags_ent."licenseKeys"
                        )
                    ELSE NULL END
                    AS ${sqlOptions.entitlement}
          FROM swid_tag_entitlement AS swtags_ent
         ${sqlOptions.excludeDenials}
         ${sqlOptions.orderBy}`;
}

/**
 * find the RTU-permission or prohibition for the swidTag
 * @param  {} res
 * @param  {} swidTag for either assetUsage or includedAssetUsage
 */
async function findRtuForSwidTag(res, swidTag) {
    if (!swidTag.swTagId) {
        lumServer.logger.debug(res, `skipped findRtuForSwidTag(${swidTag.swTagId})`);
        return;
    }
    lumServer.logger.debug(res, `in findRtuForSwidTag(${swidTag.swTagId})`);

    const keys = new SqlParams();
    keys.addField("swTagId", swidTag.swTagId);
    const actionField = new SqlParams(keys);
    actionField.setKeyValues("action", res.locals.params.action === 'use' ? ['use']: [res.locals.params.action, 'use']);
    const userField = new SqlParams(actionField);
    userField.addField("userId", res.locals.params.userId);
    const reqUsageCountField = new SqlParams(userField);
    reqUsageCountField.addField("reqUsageCount", swidTag.usageMetrics.reqUsageCount);

    const sqlCmd = genSqlToEntitle(true, keys, actionField, userField, reqUsageCountField);

    const result = await pgclient.sqlQuery(res, sqlCmd, keys.getAllValues());
    if (result.rows.length) {
        swidTag.rightToUse = result.rows[0];
        lumServer.logger.debug(res, `RTU found for swTagId(${swidTag.swTagId})`, swidTag.rightToUse);
    }
    lumServer.logger.debug(res, `out findRtuForSwidTag(${swidTag.swTagId})`);
}

/**
 * find and check the RTU-permission for the swidTag
 * @param  {} res
 * @param  {} swidTag with swTagId from either the assetUsage or includedAssetUsage
 */
async function checkRtuForSwidTag(res, swidTag) {
    await findRtuForSwidTag(res, swidTag);

    if (swidTag.rightToUse == null) {
        utils.addDenial(swidTag, "denied_due_swidTagNotFound", "swidTagNotFound", `swid-tag(${swidTag.swTagId}) not found`, res.locals.params.action);
        return;
    }
    if (swidTag.rightToUse.denial) {
        if (!swidTag.usageDenialSummary) {
            swidTag.usageDenialSummary = swidTag.rightToUse.denial.denialReason;
        }
        swidTag.usageDenials.push(swidTag.rightToUse.denial);
        return;
    }

    if (swidTag.rightToUse.isUsedBySwCreator) {
        swidTag.usageMetrics.usageType        = "bySwCreator";
        swidTag.usageMetrics.usageMetricsId   = swidTag.swTagId;
        swidTag.usageMetrics.assetUsageRuleId = null;
        lumServer.logger.debug(res, `RTU not required for software creator checkRtuForSwidTag(${res.locals.params.userId}) -
            entitled checkRtuForSwidTag(${swidTag.swTagId})`);
        return;
    }
    if (swidTag.rightToUse.isRtuRequired === false) {
        swidTag.usageMetrics.usageType        = "freeToUse";
        swidTag.usageMetrics.usageMetricsId   = swidTag.swTagId;
        swidTag.usageMetrics.assetUsageRuleId = null;
        lumServer.logger.debug(res, `RTU not required - entitled checkRtuForSwidTag(${swidTag.swTagId})`);
        return;
    }
    if (swidTag.rightToUse.isRtuRequired == null) {
        lumServer.logger.warn(res, `no license profile -> not looking for RTU - checkRtuForSwidTag(${swidTag.swTagId})`);
        return;
    }
    swidTag.usageMetrics.usageType        = "rightToUse";
    swidTag.usageMetrics.usageMetricsId   = null;
    swidTag.usageMetrics.assetUsageRuleId = null;

    if (swidTag.rightToUse.entitlement == null) {
        const denialsCount = await collectDenialsForSwidTag(res, swidTag);
        if (!denialsCount) {
            utils.addDenial(swidTag, "denied_due_agreementNotFound", "agreementNotFound",
                `swid-tag(${swidTag.swTagId}) has been found
                    but no asset-usage-agreement from ${swidTag.rightToUse.softwareLicensorId}
                    currently provide the right to use this asset for action(${res.locals.params.action})`,
                res.locals.params.action);
        }
        return;
    }

    swidTag.usageMetrics.usageMetricsId   = swidTag.rightToUse.assetUsageRuleId;
    swidTag.usageMetrics.assetUsageRuleId = swidTag.rightToUse.assetUsageRuleId;
    lumServer.logger.debug(res, `entitled checkRtuForSwidTag(${swidTag.swTagId})`, swidTag.rightToUse.entitlement);
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
    if (!swidTag.rightToUse.isRtuRequired) {
        lumServer.logger.debug(res, `skipped collectDenialsForSwidTag(${swidTag.swTagId})`);
        return;
    }
    lumServer.logger.debug(res, `in collectDenialsForSwidTag(${swidTag.swTagId})`);

    const keys = new SqlParams();
    keys.addField("swTagId", swidTag.swTagId);
    const actionField = new SqlParams(keys);
    actionField.setKeyValues("action", res.locals.params.action === 'use' ? ['use']: [res.locals.params.action, 'use']);
    const userField = new SqlParams(actionField);
    userField.addField("userId", res.locals.params.userId);
    const reqUsageCountField = new SqlParams(userField);
    reqUsageCountField.addField("reqUsageCount", swidTag.usageMetrics.reqUsageCount);

    const sqlCmd = `WITH swt_ctlg AS (
        SELECT stag."swTagId", ARRAY_AGG(DISTINCT ctlg."swCatalogId") AS "swCatalogIds",
                               ARRAY_AGG(DISTINCT ctlg."swCatalogType") AS "swCatalogTypes"
          FROM (SELECT "swTagId", "swCatalogs"
                  FROM "swidTag" WHERE ${keys.where}) AS stag
                       CROSS JOIN LATERAL JSONB_TO_RECORDSET(stag."swCatalogs")
                               AS ctlg("swCatalogId" TEXT, "swCatalogType" TEXT)
                 GROUP BY stag."swTagId")
        SELECT
            CASE WHEN NOT rtu."rightToUseActive" THEN
                JSON_BUILD_OBJECT(
                    'denialCode', 'denied_due_rightToUseRevoked',
                    'denialType', 'rightToUseRevoked',
                    'denialReason', FORMAT(
                        'rightToUse %s on %s(%s) under agreement(%s) for action(%s)',
                        COALESCE(rtu."closureReason", 'revoked'),
                        rtu."assetUsageRuleType", rtu."rightToUseId", rtu."assetUsageAgreementId", "rtuAction"),
                    'deniedAction', "rtuAction",
                    'deniedAssetUsageAgreementId', rtu."assetUsageAgreementId",
                    'deniedAssetUsageAgreementRevision', agr."assetUsageAgreementRevision",
                    'deniedRightToUseId', rtu."rightToUseId",
                    'deniedRightToUseRevision', rtu."rightToUseRevision",
                    'denialReqItemName', 'rightToUseActive',
                    'denialReqItemValue', TRUE
                ) ELSE NULL END AS "denied_due_rightToUseRevoked",

            CASE WHEN rtu."rightToUseActive"
                  AND NOT COALESCE(NOW()::DATE <= rtu."expireOn", TRUE) THEN
                JSON_BUILD_OBJECT(
                    'denialCode', 'denied_due_expireOn',
                    'denialType', 'timingConstraint',
                    'denialReason', FORMAT(
                        'rightToUse expired: (today(%s) > expireOn(%s)) on %s(%s) under agreement(%s) for action(%s)',
                        NOW()::DATE, rtu."expireOn",
                        rtu."assetUsageRuleType", rtu."rightToUseId", rtu."assetUsageAgreementId", "rtuAction"),
                    'deniedAction', "rtuAction",
                    'deniedAssetUsageAgreementId', rtu."assetUsageAgreementId",
                    'deniedAssetUsageAgreementRevision', agr."assetUsageAgreementRevision",
                    'deniedRightToUseId', rtu."rightToUseId",
                    'deniedRightToUseRevision', rtu."rightToUseRevision",
                    'denialReqItemName', 'date',
                    'denialReqItemValue', NOW()::DATE,
                    'deniedConstraint', JSON_BUILD_OBJECT('expireOn', rtu."expireOn")
                ) ELSE NULL END AS "denied_due_expireOn",

            CASE WHEN rtu."rightToUseActive"
                  AND NOT COALESCE(NOW() <= rtu."usageEnds", TRUE) THEN
                JSON_BUILD_OBJECT(
                    'denialCode', 'denied_due_goodFor',
                    'denialType', 'timingConstraint',
                    'denialReason', FORMAT(
                        'rightToUse too late: (now(%s) > end-of-good-for(%s)), usage started(%s), was good for(%s) on %s(%s) under agreement(%s) for action(%s)',
                        TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
                        TO_CHAR(rtu."usageEnds" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
                        TO_CHAR(rtu."usageStarted" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
                        TRIM(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(
                            TO_CHAR(rtu."goodFor",
                                ' YYYY "years" MM "months" DD "days" HH24 "hours" MI "minutes" SS.MS "seconds"'),
                            ' 0+([1-9]\\d*[.]?\\d*|0[.]\\d*) ', ' \\1 ', 'g'),
                            '\\m0+[.]?0* [a-z]+s\\M', '', 'g'),
                            '[.]-', '.', 'g'),
                            '\\m1 ([a-z]+)s\\M', '1 \\1', 'g'),
                            '  ', ' ', 'g')),
                        rtu."assetUsageRuleType", rtu."rightToUseId", rtu."assetUsageAgreementId", "rtuAction"),
                    'deniedAction', "rtuAction",
                    'deniedAssetUsageAgreementId', rtu."assetUsageAgreementId",
                    'deniedAssetUsageAgreementRevision', agr."assetUsageAgreementRevision",
                    'deniedRightToUseId', rtu."rightToUseId",
                    'deniedRightToUseRevision', rtu."rightToUseRevision",
                    'denialReqItemName', 'datetime',
                    'denialReqItemValue', TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
                    'deniedConstraint', JSON_BUILD_OBJECT(
                        'goodFor', REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(
                            TO_CHAR(rtu."goodFor", '"P" YYYY "Y" MM "M" DD "D" "T" HH24 "H" MI "M" SS.MS "S"'),
                            ' 0+([1-9]\\d*[.]?\\d*|0[.]\\d*) ', ' \\1 ', 'g'),
                            '\\m0+[.]?0* [A-Z]\\M', '', 'g'),
                            '[.]-', '.', 'g'), '(\\s+|T\\s+$)', '', 'g'),
                        'usageStarted', TO_CHAR(rtu."usageStarted" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
                        'usageEnded', TO_CHAR(rtu."usageEnds" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
                    )
                ) ELSE NULL END AS "denied_due_goodFor",

            CASE WHEN rtu."rightToUseActive"
                  AND NOT COALESCE(NOW()::DATE >= rtu."enableOn", TRUE) THEN
                JSON_BUILD_OBJECT(
                    'denialCode', 'denied_due_enableOn',
                    'denialType', 'timingConstraint',
                    'denialReason', FORMAT(
                        'rightToUse not enabled yet: (today(%s) < enableOn(%s)) on %s(%s) under agreement(%s) for action(%s)',
                        NOW()::DATE, rtu."enableOn",
                        rtu."assetUsageRuleType", rtu."rightToUseId", rtu."assetUsageAgreementId", "rtuAction"),
                    'deniedAction', "rtuAction",
                    'deniedAssetUsageAgreementId', rtu."assetUsageAgreementId",
                    'deniedAssetUsageAgreementRevision', agr."assetUsageAgreementRevision",
                    'deniedRightToUseId', rtu."rightToUseId",
                    'deniedRightToUseRevision', rtu."rightToUseRevision",
                    'denialReqItemName', 'date',
                    'denialReqItemValue', NOW()::DATE,
                    'deniedConstraint', JSON_BUILD_OBJECT('enableOn', rtu."enableOn")
                ) ELSE NULL END AS "denied_due_enableOn",

            CASE WHEN ${sqlRtuActiveAndTimingOK}
                  AND NOT (rtu."targetRefinement"#>'{lum:swPersistentId}' IS NULL
                   OR ${genCasesByOperator(`rtu."targetRefinement"#>>'{lum:swPersistentId,operator}'`,
                       `swid_tag."swPersistentId"`, `rtu."targetRefinement"#>'{lum:swPersistentId,rightOperand}'`, 'TEXT')}) THEN
                JSON_BUILD_OBJECT(
                    'denialCode', 'denied_due_swPersistentIdOnTarget',
                    'denialType', 'matchingConstraintOnTarget',
                    'denialReason', FORMAT(
                        'not targeted by %s: (%s not %s %s) on %s(%s) under agreement(%s) for action(%s)',
                        (rtu."targetRefinement"#>>'{lum:swPersistentId,leftOperand}'),
                        swid_tag."swPersistentId",
                        (rtu."targetRefinement"#>>'{lum:swPersistentId,operator}'),
                        (rtu."targetRefinement"#>>'{lum:swPersistentId,rightOperand}'),
                        rtu."assetUsageRuleType", rtu."rightToUseId", rtu."assetUsageAgreementId", "rtuAction"),
                    'deniedAction', "rtuAction",
                    'deniedAssetUsageAgreementId', rtu."assetUsageAgreementId",
                    'deniedAssetUsageAgreementRevision', agr."assetUsageAgreementRevision",
                    'deniedRightToUseId', rtu."rightToUseId",
                    'deniedRightToUseRevision', rtu."rightToUseRevision",
                    'denialReqItemName', 'swPersistentId',
                    'denialReqItemValue', swid_tag."swPersistentId",
                    'deniedConstraint', rtu."targetRefinement"#>'{lum:swPersistentId}'
                ) ELSE NULL END AS "denied_due_swPersistentIdOnTarget",

            CASE WHEN ${sqlRtuActiveAndTimingOK}
                  AND NOT (rtu."targetRefinement"#>'{lum:swTagId}' IS NULL
                   OR ${genCasesByOperator(`rtu."targetRefinement"#>>'{lum:swTagId,operator}'`,
                       `swid_tag."swTagId"`, `rtu."targetRefinement"#>'{lum:swTagId,rightOperand}'`, 'TEXT')}) THEN
                JSON_BUILD_OBJECT(
                    'denialCode', 'denied_due_swTagIdOnTarget',
                    'denialType', 'matchingConstraintOnTarget',
                    'denialReason', FORMAT(
                        'not targeted by %s: (%s not %s %s) on %s(%s) under agreement(%s) for action(%s)',
                        (rtu."targetRefinement"#>>'{lum:swTagId,leftOperand}'),
                        swid_tag."swTagId",
                        (rtu."targetRefinement"#>>'{lum:swTagId,operator}'),
                        (rtu."targetRefinement"#>>'{lum:swTagId,rightOperand}'),
                        rtu."assetUsageRuleType", rtu."rightToUseId", rtu."assetUsageAgreementId", "rtuAction"),
                    'deniedAction', "rtuAction",
                    'deniedAssetUsageAgreementId', rtu."assetUsageAgreementId",
                    'deniedAssetUsageAgreementRevision', agr."assetUsageAgreementRevision",
                    'deniedRightToUseId', rtu."rightToUseId",
                    'deniedRightToUseRevision', rtu."rightToUseRevision",
                    'denialReqItemName', 'swTagId',
                    'denialReqItemValue', swid_tag."swTagId",
                    'deniedConstraint', rtu."targetRefinement"#>'{lum:swTagId}'
                ) ELSE NULL END AS "denied_due_swTagIdOnTarget",

            CASE WHEN ${sqlRtuActiveAndTimingOK}
                  AND NOT (rtu."targetRefinement"#>'{lum:swProductName}' IS NULL
                   OR ${genCasesByOperator(`rtu."targetRefinement"#>>'{lum:swProductName,operator}'`,
                       `swid_tag."swProductName"`, `rtu."targetRefinement"#>'{lum:swProductName,rightOperand}'`, 'TEXT')}) THEN
                JSON_BUILD_OBJECT(
                    'denialCode', 'denied_due_swProductNameOnTarget',
                    'denialType', 'matchingConstraintOnTarget',
                    'denialReason', FORMAT(
                        'not targeted by %s: (%s not %s %s) on %s(%s) under agreement(%s) for action(%s)',
                        (rtu."targetRefinement"#>>'{lum:swProductName,leftOperand}'),
                        swid_tag."swProductName",
                        (rtu."targetRefinement"#>>'{lum:swProductName,operator}'),
                        (rtu."targetRefinement"#>>'{lum:swProductName,rightOperand}'),
                        rtu."assetUsageRuleType", rtu."rightToUseId", rtu."assetUsageAgreementId", "rtuAction"),
                    'deniedAction', "rtuAction",
                    'deniedAssetUsageAgreementId', rtu."assetUsageAgreementId",
                    'deniedAssetUsageAgreementRevision', agr."assetUsageAgreementRevision",
                    'deniedRightToUseId', rtu."rightToUseId",
                    'deniedRightToUseRevision', rtu."rightToUseRevision",
                    'denialReqItemName', 'swProductName',
                    'denialReqItemValue', swid_tag."swProductName",
                    'deniedConstraint', rtu."targetRefinement"#>'{lum:swProductName}'
                ) ELSE NULL END AS "denied_due_swProductNameOnTarget",

            CASE WHEN ${sqlRtuActiveAndTimingOK}
                  AND NOT (rtu."targetRefinement"#>'{lum:swCategory}' IS NULL
                   OR ${genCasesByOperator(`rtu."targetRefinement"#>>'{lum:swCategory,operator}'`,
                       `swid_tag."swCategory"`, `rtu."targetRefinement"#>'{lum:swCategory,rightOperand}'`, 'TEXT')}) THEN
                JSON_BUILD_OBJECT(
                    'denialCode', 'denied_due_swCategoryOnTarget',
                    'denialType', 'matchingConstraintOnTarget',
                    'denialReason', FORMAT(
                        'not targeted by %s: (%s not %s %s) on %s(%s) under agreement(%s) for action(%s)',
                        (rtu."targetRefinement"#>>'{lum:swCategory,leftOperand}'),
                        swid_tag."swCategory",
                        (rtu."targetRefinement"#>>'{lum:swCategory,operator}'),
                        (rtu."targetRefinement"#>>'{lum:swCategory,rightOperand}'),
                        rtu."assetUsageRuleType", rtu."rightToUseId", rtu."assetUsageAgreementId", "rtuAction"),
                    'deniedAction', "rtuAction",
                    'deniedAssetUsageAgreementId', rtu."assetUsageAgreementId",
                    'deniedAssetUsageAgreementRevision', agr."assetUsageAgreementRevision",
                    'deniedRightToUseId', rtu."rightToUseId",
                    'deniedRightToUseRevision', rtu."rightToUseRevision",
                    'denialReqItemName', 'swCategory',
                    'denialReqItemValue', swid_tag."swCategory",
                    'deniedConstraint', rtu."targetRefinement"#>'{lum:swCategory}'
                ) ELSE NULL END AS "denied_due_swCategoryOnTarget",

            CASE WHEN ${sqlRtuActiveAndTimingOK}
                  AND NOT (rtu."targetRefinement"#>'{lum:swCatalogId}' IS NULL
                   OR COALESCE(rtu."targetRefinement"#>'{lum:swCatalogId,rightOperand}' ?| ctlgs."swCatalogIds", FALSE)) THEN
                JSON_BUILD_OBJECT(
                    'denialCode', 'denied_due_swCatalogIdOnTarget',
                    'denialType', 'matchingConstraintOnTarget',
                    'denialReason', FORMAT(
                        'not targeted by %s: (none of %s %s %s) on %s(%s) under agreement(%s) for action(%s)',
                        (rtu."targetRefinement"#>>'{lum:swCatalogId,leftOperand}'),
                        ARRAY_TO_JSON(ctlgs."swCatalogIds")::TEXT,
                        (rtu."targetRefinement"#>>'{lum:swCatalogId,operator}'),
                        (rtu."targetRefinement"#>>'{lum:swCatalogId,rightOperand}'),
                        rtu."assetUsageRuleType", rtu."rightToUseId", rtu."assetUsageAgreementId", "rtuAction"),
                    'deniedAction', "rtuAction",
                    'deniedAssetUsageAgreementId', rtu."assetUsageAgreementId",
                    'deniedAssetUsageAgreementRevision', agr."assetUsageAgreementRevision",
                    'deniedRightToUseId', rtu."rightToUseId",
                    'deniedRightToUseRevision', rtu."rightToUseRevision",
                    'denialReqItemName', 'swCatalogId',
                    'denialReqItemValue', ctlgs."swCatalogIds",
                    'deniedConstraint', rtu."targetRefinement"#>'{lum:swCatalogId}'
                ) ELSE NULL END AS "denied_due_swCatalogIdOnTarget",

            CASE WHEN ${sqlRtuActiveAndTimingOK}
                  AND NOT (rtu."targetRefinement"#>'{lum:swCatalogType}' IS NULL
                   OR COALESCE(rtu."targetRefinement"#>'{lum:swCatalogType,rightOperand}' ?| ctlgs."swCatalogTypes", FALSE)) THEN
                JSON_BUILD_OBJECT(
                    'denialCode', 'denied_due_swCatalogTypeOnTarget',
                    'denialType', 'matchingConstraintOnTarget',
                    'denialReason', FORMAT(
                        'not targeted by %s: (none of %s %s %s) on %s(%s) under agreement(%s) for action(%s)',
                        (rtu."targetRefinement"#>>'{lum:swCatalogType,leftOperand}'),
                        ARRAY_TO_JSON(ctlgs."swCatalogTypes")::TEXT,
                        (rtu."targetRefinement"#>>'{lum:swCatalogType,operator}'),
                        (rtu."targetRefinement"#>>'{lum:swCatalogType,rightOperand}'),
                        rtu."assetUsageRuleType", rtu."rightToUseId", rtu."assetUsageAgreementId", "rtuAction"),
                    'deniedAction', "rtuAction",
                    'deniedAssetUsageAgreementId', rtu."assetUsageAgreementId",
                    'deniedAssetUsageAgreementRevision', agr."assetUsageAgreementRevision",
                    'deniedRightToUseId', rtu."rightToUseId",
                    'deniedRightToUseRevision', rtu."rightToUseRevision",
                    'denialReqItemName', 'swCatalogType',
                    'denialReqItemValue', ctlgs."swCatalogTypes",
                    'deniedConstraint', rtu."targetRefinement"#>'{lum:swCatalogType}'
                ) ELSE NULL END AS "denied_due_swCatalogTypeOnTarget",

            CASE WHEN ${sqlRtuActiveAndTimingOK}
                  AND NOT (rtu."assigneeRefinement"#>'{lum:countUniqueUsers}' IS NULL
                   OR (rtu."assigneeMetrics"->'users')::JSONB ? ${userField.idxKeyValues}
                   OR ${genCasesByOperator(`rtu."assigneeRefinement"#>>'{lum:countUniqueUsers,operator}'`,
                       `COALESCE(JSONB_ARRAY_LENGTH((rtu."assigneeMetrics"->'users')::JSONB), 0) + 1`,
                       `rtu."assigneeRefinement"#>'{lum:countUniqueUsers,rightOperand}'`, 'INTEGER')}) THEN
                JSON_BUILD_OBJECT(
                    'denialCode', 'denied_due_countUniqueUsersOnAssignee',
                    'denialType', 'matchingConstraintOnAssignee',
                    'denialReason', FORMAT(
                        'too many users: (%s not in %s) on %s(%s) under agreement(%s) for action(%s)',
                        ${userField.idxKeyValues}, rtu."assigneeMetrics"::TEXT,
                        rtu."assetUsageRuleType", rtu."rightToUseId", rtu."assetUsageAgreementId", "rtuAction"),
                    'deniedAction', "rtuAction",
                    'deniedAssetUsageAgreementId', rtu."assetUsageAgreementId",
                    'deniedAssetUsageAgreementRevision', agr."assetUsageAgreementRevision",
                    'deniedRightToUseId', rtu."rightToUseId",
                    'deniedRightToUseRevision', rtu."rightToUseRevision",
                    'denialReqItemName', 'userId',
                    'denialReqItemValue', ${userField.idxKeyValues},
                    'deniedConstraint', rtu."assigneeRefinement"#>'{lum:countUniqueUsers}',
                    'deniedMetrics', rtu."assigneeMetrics"
                ) ELSE NULL END AS "denied_due_countUniqueUsersOnAssignee",

            CASE WHEN ${sqlRtuActiveAndTimingOK}
                  AND NOT ((rtu."assigneeRefinement"#>'{lum:users}') IS NULL
                   OR ${genCasesByOperator(`rtu."assigneeRefinement"#>>'{lum:users,operator}'`,
                       `${userField.idxKeyValues}`, `rtu."assigneeRefinement"#>'{lum:users,rightOperand}'`, 'TEXT')}) THEN
                JSON_BUILD_OBJECT(
                    'denialCode', 'denied_due_usersOnAssignee',
                    'denialType', 'matchingConstraintOnAssignee',
                    'denialReason', FORMAT(
                        'user not in assignee %s: (%s not %s %s) on %s(%s) under agreement(%s) for action(%s)',
                        (rtu."assigneeRefinement"#>>'{lum:users,leftOperand}'),
                        ${userField.idxKeyValues},
                        (rtu."assigneeRefinement"#>>'{lum:users,operator}'),
                        (rtu."assigneeRefinement"#>>'{lum:users,rightOperand}'),
                        rtu."assetUsageRuleType", rtu."rightToUseId", rtu."assetUsageAgreementId", "rtuAction"),
                    'deniedAction', "rtuAction",
                    'deniedAssetUsageAgreementId', rtu."assetUsageAgreementId",
                    'deniedAssetUsageAgreementRevision', agr."assetUsageAgreementRevision",
                    'deniedRightToUseId', rtu."rightToUseId",
                    'deniedRightToUseRevision', rtu."rightToUseRevision",
                    'denialReqItemName', 'userId',
                    'denialReqItemValue', ${userField.idxKeyValues},
                    'deniedConstraint', rtu."assigneeRefinement"#>'{lum:users}'
                ) ELSE NULL END AS "denied_due_usersOnAssignee",

            CASE WHEN ${sqlRtuActiveAndTimingOK}
                  AND NOT (rtu."usageConstraints"#>'{count}' IS NULL
                   OR ${genCasesByOperator(`rtu."usageConstraints"#>>'{count,operator}'`,
                       `COALESCE((usmcs."metrics"#>'{count}')::INTEGER, 0) + ${reqUsageCountField.idxKeyValues}`,
                       `rtu."usageConstraints"#>'{count,rightOperand}'`, 'INTEGER')}) THEN
                JSON_BUILD_OBJECT(
                    'denialCode', 'denied_due_usageCount',
                    'denialType', 'usageConstraint',
                    'denialReason', FORMAT(
                        'exceeding the usage %s: (%s not %s %s) on %s(%s) under agreement(%s) for action(%s)',
                        (rtu."usageConstraints"#>>'{count,leftOperand}'),
                        COALESCE((usmcs."metrics"#>'{count}')::INTEGER, 0) + ${reqUsageCountField.idxKeyValues},
                        (rtu."usageConstraints"#>>'{count,operator}'),
                        (rtu."usageConstraints"#>>'{count,rightOperand}'),
                        rtu."assetUsageRuleType", rtu."rightToUseId", rtu."assetUsageAgreementId", "rtuAction"),
                    'deniedAction', "rtuAction",
                    'deniedAssetUsageAgreementId', rtu."assetUsageAgreementId",
                    'deniedAssetUsageAgreementRevision', agr."assetUsageAgreementRevision",
                    'deniedRightToUseId', rtu."rightToUseId",
                    'deniedRightToUseRevision', rtu."rightToUseRevision",
                    'denialReqItemName', 'usageCount',
                    'denialReqItemValue', ${reqUsageCountField.idxKeyValues},
                    'deniedConstraint', rtu."usageConstraints"#>'{count}',
                    'deniedMetrics', COALESCE((usmcs."metrics"#>'{count}')::INTEGER, 0)
                ) ELSE NULL END AS "denied_due_usageCount"
          FROM (SELECT * FROM "swidTag" WHERE ${keys.where}) AS swid_tag
               JOIN "rightToUse" AS rtu ON (rtu."softwareLicensorId" = swid_tag."softwareLicensorId")
               JOIN "assetUsageAgreement" AS agr ON (rtu."softwareLicensorId" = agr."softwareLicensorId"
                                                AND rtu."assetUsageAgreementId" = agr."assetUsageAgreementId")
               CROSS JOIN LATERAL JSON_ARRAY_ELEMENTS_TEXT(ARRAY_TO_JSON(rtu."actions")) AS "rtuAction"
               LEFT OUTER JOIN LATERAL (SELECT ums.* FROM "usageMetrics" AS ums
                                         WHERE ums."usageMetricsId" = rtu."assetUsageRuleId"
                                           AND ums."action" = "rtuAction"
                                           AND ums."usageType" = 'rightToUse') AS usmcs ON TRUE
               LEFT OUTER JOIN LATERAL (SELECT swt_ctlg."swCatalogIds", swt_ctlg."swCatalogTypes" FROM swt_ctlg
                                         WHERE swt_ctlg."swTagId" = swid_tag."swTagId") AS ctlgs ON TRUE
         WHERE "rtuAction" IN (${actionField.idxKeyValues})
           AND rtu."assetUsageRuleType" != '${odrl.RULE_TYPES.prohibition}'
         ORDER BY CASE WHEN ${sqlRtuActiveAndTimingOK} THEN '0' ELSE '1' END,
                  NULLIF("rtuAction", 'use') NULLS LAST,
                  rtu."created", rtu."assetUsageRuleId"
         LIMIT 100`;

    const result = await pgclient.sqlQuery(res, sqlCmd, keys.getAllValues());
    const visitedAgreementIds = {};
    const visitedDenials = {};
    for (const deniedRightToUse of result.rows) {
        for (const denial of Object.values(deniedRightToUse)) {
            if (!denial) {continue;}
            const visitedDenial = JSON.stringify(denial);
            if (visitedDenials[visitedDenial]) {continue;}
            visitedDenials[visitedDenial] = true;
            if (!visitedAgreementIds[denial.deniedAssetUsageAgreementId]) {
                visitedAgreementIds[denial.deniedAssetUsageAgreementId] = true;
            }
            swidTag.usageDenials.push(denial);
        }
    }
    const denialsCount = Object.keys(visitedDenials).length;
    if (denialsCount) {
        const deniedAUAgrIds = Object.keys(visitedAgreementIds);
        const agrCount = deniedAUAgrIds.length;
        swidTag.usageDenialSummary = utils.makeOneLine(`swid-tag(${swidTag.swTagId}) has been found
            and ${agrCount>1?'':'an '}asset-usage-agreement${agrCount>1?'s':''}
            from ${swidTag.rightToUse.softwareLicensorId} ha${agrCount>1?'ve':'s'} been found
            but ${denialsCount} constraint${denialsCount>1?'s':''}
            on the agreement${agrCount>1?'s':''}(${deniedAUAgrIds.join(', ')})
            den${denialsCount>1?'y':'ies'} the usage of this asset`);
    }
    lumServer.logger.debug(res, `out collectDenialsForSwidTag(${swidTag.swTagId}): ${swidTag.usageDenialSummary}`);
    return denialsCount;
}
/**
 * increment counters and record userId into usageMetrics table
 * @param  {} res
 * @param  {} swidTag
 */
async function incrementUsageMetrics(res, swidTag) {
    if (!swidTag.usageMetrics || !swidTag.usageMetrics.usageMetricsId) {
        lumServer.logger.debug(res, `skipped incrementUsageMetrics(${swidTag.swTagId})`);
        return;
    }
    lumServer.logger.debug(res, `in incrementUsageMetrics(${swidTag.swTagId})`);

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
    lumServer.logger.debug(res, `out incrementUsageMetrics(${swidTag.swTagId}`);
}
/**
 * add userId into assigneeMetrics field in rightToUse table
 * @param  {} res
 * @param  {} swidTag
 */
async function updateAssigneeMetrics(res, swidTag) {
    if (!swidTag.rightToUse || swidTag.rightToUse.isUserInAssigneeMetrics || !swidTag.usageMetrics.assetUsageRuleId) {
        lumServer.logger.debug(res, `skipped updateAssigneeMetrics(${swidTag.swTagId})`, swidTag);
        return;
    }
    lumServer.logger.debug(res, `in updateAssigneeMetrics(${swidTag.swTagId})`);

    const keys = new SqlParams();
    keys.addField("assetUsageRuleId", swidTag.usageMetrics.assetUsageRuleId);
    const userField = new SqlParams(keys);
    userField.addField("userId", res.locals.params.userId);
    const houseFields = new SqlParams(userField);
    houseFields.addField("metricsModifierReqId", res.locals.requestId);
    const requestIdField = new SqlParams(houseFields);
    requestIdField.addField("requestId", res.locals.requestId);

    const sqlCmd = `UPDATE "rightToUse" SET "metricsModified" = NOW(),
            "metricsRevision" = "metricsRevision" + 1,
            "assigneeMetrics" = "assigneeMetrics"
                || CASE WHEN ("assigneeMetrics"->'users')::JSONB ? ${userField.idxKeyValues} THEN '{}'::JSONB
                        ELSE JSONB_BUILD_OBJECT('users', ("assigneeMetrics"->'users')::JSONB
                                              || ('["' || ${userField.idxKeyValues} || '"]')::JSONB) END,
            "usageStartReqId" = COALESCE("usageStartReqId", ${requestIdField.idxKeyValues}),
            "usageStarted"    = COALESCE("usageStarted", NOW()),
            "usageEnds"       = COALESCE("usageEnds", NOW() + "goodFor")
            ${houseFields.updates} WHERE ${keys.where}`;
    await pgclient.sqlQuery(res, sqlCmd, keys.getAllValues());
    lumServer.logger.debug(res, `out updateAssigneeMetrics(${swidTag.swTagId}`);
}

/**
 * copy swidTag and licenseProfile usage into the assetUsage
 * @param  {} res
 * @param  {} assetUsage either assetUsage or includedAssetUsage
 */
function copySwidTagUsageToAssetUsage(res, assetUsage) {
    const swidTag = res.locals.dbdata.swidTags[assetUsage.swTagId];

    if (swidTag.rightToUse) {
        utils.copyTo(assetUsage, swidTagAttributes,        swidTag.rightToUse);
        utils.copyTo(assetUsage, licenseProfileAttributes, swidTag.rightToUse);
        assetUsage.isUsedBySwCreator   = swidTag.rightToUse.isUsedBySwCreator;
        assetUsage.entitlement         = swidTag.rightToUse.entitlement;
        assetUsage.rightToUse          = swidTag.rightToUse;
    }
    assetUsage.usageMetrics            = swidTag.usageMetrics;
    assetUsage.assetUsageDenialSummary = swidTag.usageDenialSummary;
    Array.prototype.push.apply(assetUsage.assetUsageDenial, swidTag.usageDenials);
}
/**
 * insert/update the assetUsage and assetUsageHistory records for the assetUsage
 * @param  {} res
 * @param  {} assetUsage
 */
async function storeAssetUsage(res, assetUsage) {
    lumServer.logger.debug(res, `in storeAssetUsage(${assetUsage.assetUsageId})`);

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
    historyFields.addField("assetUsageReqId", res.locals.requestId);
    historyFields.addField("assetUsageType", res.locals.params.assetUsageType);
    historyFields.addField("action", res.locals.params.action);
    historyFields.addField("swTagId", assetUsage.swTagId);
    historyFields.addFieldsFromBody(assetUsageHistoryRtuAttributes, assetUsage.rightToUse || {});
    historyFields.addField("usageMetricsId", (assetUsage.usageMetrics || {}).usageMetricsId);
    historyFields.addField("assetUsageDenialSummary", assetUsage.assetUsageDenialSummary);
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
    lumServer.logger.debug(res, `out storeAssetUsage(${assetUsage.assetUsageId})`);
}

module.exports = {
    /**
     * convert assetUsage or includedAssetUsage to shallow assetUsage object
     * with precursors for assetUsageDenial and entitlement
     * @param  {} assetUsage
     */
    convertToAssetUsage(assetUsage) {
        return {
            swTagId:                 (assetUsage.swTagId         || assetUsage.includedSwTagId),
            assetUsageId:            (assetUsage.assetUsageId    || assetUsage.includedAssetUsageId),
            action:                  assetUsage.action,
            isIncludedAsset:         (assetUsage.isIncludedAsset || !!assetUsage.includedAssetUsageId),
            usageEntitled:           null,
            isUsedBySwCreator:       null,
            assetUsageSeq:           null,
            swidTagRevision:         null,
            licenseProfileId:        null,
            licenseProfileRevision:  null,
            isRtuRequired:           null,
            softwareLicensorId:      null,
            entitlement:             null,
            assetUsageDenialSummary: null,
            assetUsageDenial:        [],
            rightToUse:              null,
            usageMetrics:            null
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
        delete assetUsage.isIncludedAsset;
        return assetUsage;
    },
    /**
     * GET the last assetUsage record from database
     * @param  {} res
     */
    async getAssetUsage(res) {
        if (!res.locals.params.assetUsageId) {
            lumServer.logger.debug(res, `skipped getAssetUsage(${res.locals.paramsStr})`);
            return;
        }
        lumServer.logger.debug(res, `in getAssetUsage(${res.locals.paramsStr})`);

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
        lumServer.logger.debug(res, `out getAssetUsage(${res.locals.paramsStr})`);
    },
    /**
     * main decision entry point to determine the asset-usage entitlement result
     * @param  {} res
     */
    async determineAssetUsageEntitlement(res) {
        if (!res.locals.params.assetUsageId) {
            lumServer.logger.debug(res, `skipped determineAssetUsageEntitlement(${res.locals.paramsStr})`);
            return;
        }
        lumServer.logger.debug(res, `in determineAssetUsageEntitlement(${res.locals.paramsStr})`);

        for await (const swidTag of Object.values(res.locals.dbdata.swidTags)) {
            await checkRtuForSwidTag(res, swidTag);
        }

        for (const assetUsage of Object.values(res.locals.assetUsages)) {
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

        lumServer.logger.debug(res, `out determineAssetUsageEntitlement(${res.locals.paramsStr})`);
    },
    /**
     * insert assetUsage records into database
     * @param  {} res
     */
    async putAssetUsage(res) {
        if (!res.locals.params.assetUsageId) {
            lumServer.logger.debug(res, `skipped putAssetUsage(${res.locals.paramsStr})`);
            return;
        }
        lumServer.logger.debug(res, `in putAssetUsage(${res.locals.paramsStr})`);

        for await (const assetUsage of Object.values(res.locals.assetUsages)) {
            await storeAssetUsage(res, assetUsage);
        }

        lumServer.logger.debug(res, `out putAssetUsage(${res.locals.paramsStr})`);
    },
    /**
     * insert included asset-usage ids into includedAssetUsage table in database
     * @param  {} res
     */
    async registerIncludedAssetUsage(res) {
        if (!res.locals.includedAssetUsageIds.length) {
            lumServer.logger.debug(res, `skipped registerIncludedAssetUsage(${res.locals.paramsStr}) - nothing included`);
            return;
        }
        lumServer.logger.debug(res, `in registerIncludedAssetUsage(${res.locals.paramsStr}) ${JSON.stringify(res.locals.includedAssetUsageIds)}`);

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

        lumServer.logger.debug(res, `out registerIncludedAssetUsage(${res.locals.paramsStr})`);
    },
    /**
     * get the last assetUsageEvent record from database
     * @param  {} res
     */
    async getAssetUsageEvent(res) {
        if (!res.locals.params.assetUsageId) {
            lumServer.logger.debug(res, `skipped getAssetUsageEvent(${res.locals.paramsStr})`);
            return;
        }
        lumServer.logger.debug(res, `in getAssetUsageEvent(${res.locals.paramsStr})`);

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
        lumServer.logger.debug(res, `out getAssetUsageEvent(${res.locals.paramsStr})`);
    },
    /**
     * insert the assetUsageReq record for the event into database
     * @param  {} res
     */
    async putAssetUsageEvent(res) {
        if (!res.locals.params.assetUsageId) {
            lumServer.logger.debug(res, `skipped putAssetUsageEvent(${res.locals.paramsStr})`);
            return;
        }
        lumServer.logger.debug(res, `in putAssetUsageEvent(${res.locals.paramsStr})`);

        const keys = new SqlParams();
        keys.addField("assetUsageId", res.locals.params.assetUsageId);
        const swidTagKey = new SqlParams(keys);
        swidTagKey.addField("swTagId", res.locals.params.swTagId);
        const houseFields = new SqlParams(swidTagKey);
        houseFields.addField("modifier", res.locals.params.userId);
        const insFields = new SqlParams(houseFields);
        insFields.addField("creator", res.locals.params.userId);
        const historyFields = new SqlParams(insFields);
        historyFields.addFieldsFromBody(assetUsageHistoryFields, res.locals.reqBody);
        historyFields.addField("assetUsageReqId", res.locals.requestId);
        historyFields.addField("action", res.locals.params.action);
        historyFields.addField("assetUsageType", res.locals.params.assetUsageType);

        const swSelectFields = new SqlParams();
        swSelectFields.addFields(swidTagAttributes);
        const lpSelectFields = new SqlParams();
        lpSelectFields.addFields(licenseProfileAttributes);
        const swLpSelectFields = new SqlParams();
        swLpSelectFields.addFields(swidTagAttributes);
        swLpSelectFields.addFields(licenseProfileAttributes);

        const sqlCmd = `WITH sw_lp AS (
            SELECT ${swidTagKey.getReturningFields('swt')}, ${swSelectFields.getReturningFields('swt')},
                   ${lpSelectFields.getReturningFields('lp')}
              FROM "swidTag" AS swt
                   LEFT OUTER JOIN "licenseProfile" AS lp ON (lp."licenseProfileId" = swt."licenseProfileId")
             WHERE ${swidTagKey.getWhere('swt')}
            )
           , asset_usage AS (
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
                (${keys.fields} ${swidTagKey.fields} ${historyFields.fields} ${insFields.fields},
                    ${swLpSelectFields.names}, "assetUsageSeq", "created")
                SELECT ${keys.idxValues} ${swidTagKey.idxValues} ${historyFields.idxValues} ${insFields.idxValues},
                    ${swLpSelectFields.names}, "assetUsageSeqTail", NOW()
                  FROM asset_usage LEFT JOIN sw_lp ON TRUE
            RETURNING auh."assetUsageSeq", ${swLpSelectFields.getReturningFields('auh')}`;
        const result = await pgclient.sqlQuery(res, sqlCmd, keys.getAllValues());

        if (result.rows.length) {
            const assetUsageEvent = result.rows[0];
            utils.copyTo(res.locals.response.assetUsageEvent, swidTagAttributes, assetUsageEvent);
            utils.copyTo(res.locals.response.assetUsageEvent, licenseProfileAttributes, assetUsageEvent);
            res.locals.response.assetUsageEvent.assetUsageSeq = assetUsageEvent.assetUsageSeq;
        }
        lumServer.logger.debug(res, `out putAssetUsageEvent(${res.locals.paramsStr})`);
    },
    /**
     * update the usageMetrics record for the event into database
     * @param  {} res
     */
    async putAssetUsageEventMetrics(res) {
        if (!res.locals.params.assetUsageId) {
            lumServer.logger.debug(res, `skipped putAssetUsageEventMetrics(${res.locals.paramsStr})`);
            return;
        }
        lumServer.logger.debug(res, `in putAssetUsageEventMetrics(${res.locals.paramsStr})`);

        const swidTag = {
            swTagId: res.locals.params.swTagId,
            usageMetrics: {
                usageMetricsId: res.locals.params.swTagId,
                usageType: "assetUsageEvent",
                reqUsageCount: 1
            }
        };
        await incrementUsageMetrics(res, swidTag);
        lumServer.logger.debug(res, `out putAssetUsageEventMetrics(${res.locals.paramsStr})`);
    },
    /**
     * get assetUsageReq records per softwareLicensorId from the database
     * @param  {} res
     */
    async getAssetUsageTracking(res) {
        if (!res.locals.params.softwareLicensorId) {
            lumServer.logger.debug(res, `skipped getAssetUsageTracking(${res.locals.paramsStr})`);
            return;
        }
        lumServer.logger.debug(res, `in getAssetUsageTracking(${res.locals.paramsStr})`);

        const keys = new SqlParams();
        keys.addField("softwareLicensorId", res.locals.params.softwareLicensorId);
        const startDateTime = new SqlParams(keys);
        const requested = `COALESCE((aur."response"->>'requested')::TIMESTAMPTZ, aur."requestStarted")`;
        let startDateTimeFilter = '';
        if (res.locals.params.startDateTime) {
            startDateTime.addField("startDateTime", res.locals.params.startDateTime);
            startDateTimeFilter = `AND ${requested} >= ${startDateTime.idxFirstValue}::TIMESTAMPTZ`;
        }

        const endDateTime = new SqlParams(startDateTime);
        let endDateTimeFilter = '';
        if (res.locals.params.endDateTime) {
            endDateTime.addField("endDateTime", res.locals.params.endDateTime);
            endDateTimeFilter = `AND ${requested} <= ${endDateTime.idxFirstValue}::TIMESTAMPTZ`;
        }

        const sqlCmd = `WITH req_ids AS (
                SELECT DISTINCT auh."assetUsageReqId"
                  FROM "assetUsageHistory" AS auh
                 WHERE ${keys.getWhere("auh")})
            SELECT aur."assetUsageType", aur."response"
              FROM "assetUsageReq" AS aur, req_ids
             WHERE aur."assetUsageReqId" = req_ids."assetUsageReqId"
                ${startDateTimeFilter}
                ${endDateTimeFilter}
             ORDER BY ${requested}, aur."assetUsageReqId"`;

        const result = await pgclient.sqlQuery(res, sqlCmd, keys.getAllValues());
        res.locals.dbdata.assetUsageTracking = result.rows;
        lumServer.logger.debug(res, `out getAssetUsageTracking(${res.locals.paramsStr})`);
    },
    /**
     * get swid-tags with available-entitlement from database per userId and action
     * @param  {} res
     */
    async getSwidTagsWithAvailableEntitlement(res) {
        if (!res.locals.params.action || !res.locals.params.userId) {
            lumServer.logger.debug(res, `skipped getSwidTagsWithAvailableEntitlement(${res.locals.paramsStr})`);
            return;
        }
        lumServer.logger.debug(res, `in getSwidTagsWithAvailableEntitlement(${res.locals.paramsStr})`);

        const keys = new SqlParams();
        const actionField = new SqlParams();
        actionField.setKeyValues("action", res.locals.params.action === 'use' ? ['use']: [res.locals.params.action, 'use']);
        const userField = new SqlParams(actionField);
        userField.addField("userId", res.locals.params.userId);
        const reqUsageCountField = new SqlParams(userField);
        reqUsageCountField.addField("reqUsageCount", 1);

        const sqlCmd = genSqlToEntitle(false, keys, actionField, userField, reqUsageCountField);

        const result = await pgclient.standaloneQuery(res, sqlCmd, actionField.getAllValues());

        result.rows.forEach(est => {if (est.availableEntitlement == null) {delete est.availableEntitlement;}});
        res.locals.response.swidTagsWithAvailableEntitlement = result.rows;
        lumServer.logger.debug(res, `out getSwidTagsWithAvailableEntitlement(${res.locals.paramsStr}): ${result.rows.length} rows`);
    }
 };
