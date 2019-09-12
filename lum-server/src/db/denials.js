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
/**
 * @file class for collecting the denials during the asset-usage entitlement request per each assetUsageId
 */

const utils = require('../utils');

"use strict";

module.exports = {
    /**
     * add a single denial to the collection of denials on assetUsage
     * @param  {} assetUsage
     * @param  {string} denialType ENUM {usageConstraint, swidTagNotFound, licenseProfileNotFound,
     *                             agreementNotFound, matchingConstraintOnAssignee, matchingConstraintOnRule}
     * @param  {string} denialReason human readable explanation why denied the entitlement
     * @param  {string} denialReqItemName name of the item that came from req or datetime or asset-action-count
     * @param  {string} denialReqItemValue value of the item that came from req or NOW() or +1 for asset-action-count
     * @param  {string} [deniedAssetUsageAgreementId] id of Asset-Usage-Agreement that caused the denial
     * @param  {string} [deniedAssetUsageAgreementRevision] 1,2,3,... revision of the assetUsageAgreement
     * @param  {string} [deniedRightToUseId] id of rightToUse that caused the denial
     * @param  {string} [deniedRightToUseRevision] 1,2,3,... revision of the rightToUse
     * @param  {string} [deniedConstraint] whole record from usageConstraint or matchingConstraint that caused the denial
     */
    addDenial(assetUsage, denialType, denialReason, denialReqItemName, denialReqItemValue,
        deniedAssetUsageAgreementId, deniedAssetUsageAgreementRevision,
        deniedRightToUseId, deniedRightToUseRevision, deniedConstraint) {
            // "assetUsageDenialSeq": (this._denials.length + 1),
        assetUsage.assetUsageDenial.push({
            "denialType": denialType,
            "denialReason": utils.makeOneLine(denialReason),
            "denialReqItemName": denialReqItemName,
            "denialReqItemValue": denialReqItemValue,
            "deniedAssetUsageAgreementId": deniedAssetUsageAgreementId,
            "deniedAssetUsageAgreementRevision": deniedAssetUsageAgreementRevision,
            "deniedRightToUseId": deniedRightToUseId,
            "deniedRightToUseRevision": deniedRightToUseRevision,
            "deniedConstraint": deniedConstraint
        });
    }
};
