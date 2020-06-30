.. ===============LICENSE_START=======================================================
.. Acumos CC-BY-4.0
.. ===================================================================================
.. Copyright (C) 2020 AT&T Intellectual Property. All rights reserved.
.. ===================================================================================
.. This Acumos documentation file is distributed by AT&T
.. under the Creative Commons Attribution 4.0 International License (the "License");
.. you may not use this file except in compliance with the License.
.. You may obtain a copy of the License at
..
..      http://creativecommons.org/licenses/by/4.0
..
.. This file is distributed on an "AS IS" BASIS,
.. WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
.. See the License for the specific language governing permissions and
.. limitations under the License.
.. ===============LICENSE_END=========================================================

========================================
Specification for denials on asset-usage
========================================

When LUM API ``/api/v1/asset-usage`` returns ``402`` indicating that the asset usage is denied,
it provides a list of denials in ``assetUsageDenial`` element for each ``assetUsage``
and/or ``includedAssetUsage``.

************************************************
The ``AssetUsageDenial`` are defined in API spec
************************************************

See :doc:`api-docs`

API spec :download:`lum-server-API.yaml <../lum-server/lum-server-api/lum-server-API.yaml>`

    .. code-block:: yaml
        :emphasize-lines: 27-51

        AssetUsageDenial:
            description: denials for the response to assetUsageReq request
            type: object
            properties:
                assetUsageDenialSummary:
                description: human readable summary for denial of the asset-usage
                type: string
                example: "swid-tag(ee48b699-3b16-4391-884c-1bec557f32b9) has been found
                    but asset-usage is prohibited by
                    prohibition(acumos://software-licensor/Company A/permission/98378924-84ff-41f5-87ac-02fd2012c727)
                    under asset-usage-agreement(acumos://software-licensor/Company A/agreement/3eb8c43a-bf19-46ab-8392-99c7efdf4106)
                    for action(acumos:deploy)"

                assetUsageDenial:
                description: collection of denial info to assetUsageReq request
                type: array
                default: []
                nullable: true
                items:
                    description: single denial info
                    type: object
                    required:
                    - denialCode
                    - denialType
                    - denialReason
                    properties:
                    denialCode:
                        description: unique code for the reason of denial.
                        Use denialCode value to construct the denial message from other parts of denial
                        beside the denialReason
                        type: string
                        enum:
                        - denied_due_swidTagNotFound
                        - denied_due_swidTagRevoked
                        - denied_due_licenseProfileNotFound
                        - denied_due_licenseProfileRevoked
                        - denied_due_agreementNotFound
                        - denied_due_rightToUseRevoked
                        - denied_due_usageProhibited
                        - denied_due_countUniqueUsersOnAssignee
                        - denied_due_usersOnAssignee
                        - denied_due_swPersistentIdOnTarget
                        - denied_due_swTagIdOnTarget
                        - denied_due_swProductNameOnTarget
                        - denied_due_swCategoryOnTarget
                        - denied_due_swCatalogIdOnTarget
                        - denied_due_swCatalogTypeOnTarget
                        - denied_due_expireOn
                        - denied_due_goodFor
                        - denied_due_enableOn
                        - denied_due_usageCount

                    denialType:
                        description: type of the reason for denial.  It can contain one or many values of denialCode
                        type: string
                        enum:
                        - swidTagNotFound
                        - swidTagRevoked
                        - licenseProfileNotFound
                        - licenseProfileRevoked
                        - agreementNotFound
                        - rightToUseRevoked
                        - usageProhibited
                        - matchingConstraintOnAssignee
                        - matchingConstraintOnTarget
                        - timingConstraint
                        - usageConstraint

                    denialReason:
                        description: human readable explanation why the entitlement was denied.
                        It consumes all other parts of denial
                        type: string

                    deniedAction:
                        description: either requested action on the asset
                        like download, publish, execute, etc. or special value of use
                        type: string

                    deniedAssetUsageAgreementId:
                        description: uid of Asset-Usage-AssetUsageAgreement that caused the denial or not match
                        type: string

                    deniedAssetUsageAgreementRevision:
                        description: 1,2,3,... revision of the AssetUsageAgreement
                        type: integer
                        format: int64

                    deniedRightToUseId:
                        description: id of rightToUse that caused the denial
                        type: string

                    deniedRightToUseRevision:
                        description: 1,2,3,... revision of the rightToUse - auto-incremented by LUM
                        type: integer
                        format: int64

                    denialReqItemName:
                        description: name of the item that came from req or NOW()
                        type: string

                    denialReqItemValue:
                        description: value of the item that came from req or NOW()
                        It can be either string or number

                    deniedConstraint:
                        description: data from usageConstraint or assignee refinement record that caused the denial
                        type: object

                    deniedConstraintInvalid:
                        description: whether the denied constraint is invalid (true) or valid (false).
                            It is invalid when rightOperand == null.
                            When this is true, the asset-usage-agreement contains error on this constraint
                        type: boolean

                    deniedMetrics:
                        description: current statistical data that caused the denial. It is optional and its structure can very
                        type: object

                example:
                    - denialCode: denied_due_usageProhibited
                    - denialType: usageProhibited
                    denialReason: "swid-tag(ee48b699-3b16-4391-884c-1bec557f32b9) has been found
                        but asset-usage is prohibited by
                        prohibition(acumos://software-licensor/Company A/permission/98378924-84ff-41f5-87ac-02fd2012c727)
                        under asset-usage-agreement(acumos://software-licensor/Company A/agreement/3eb8c43a-bf19-46ab-8392-99c7efdf4106)
                        for action(acumos:deploy)"
                    deniedAction: "acumos:deploy"
                    deniedAssetUsageAgreementId: "acumos://software-licensor/Company A/agreement/3eb8c43a-bf19-46ab-8392-99c7efdf4106"
                    deniedAssetUsageAgreementRevision: 19
                    deniedRightToUseId: "acumos://software-licensor/Company A/permission/98378924-84ff-41f5-87ac-02fd2012c727"
                    deniedRightToUseRevision: 19
                    denialReqItemName: action
                    denialReqItemValue: "acumos:deploy"
                    deniedConstraint:
                        action: "acumos:deploy"

******************************************
The examples for each denial is as follows
******************************************

swidTag not found ``denied_due_swidTagNotFound``
================================================

    .. code-block:: json
        :emphasize-lines: 2

        {
            "denialCode": "denied_due_swidTagNotFound",
            "denialType": "swidTagNotFound",
            "denialReason": "swid-tag(unit-test-swTagId-not-to-be-found) not found",
            "deniedAction": "acumos:deploy",
            "denialReqItemName": "swTagId",
            "denialReqItemValue": "unit-test-swTagId-not-to-be-found"
        }

----

swidTag revoked ``denied_due_swidTagRevoked``
=============================================

    .. code-block:: json
        :emphasize-lines: 2

        {
            "denialCode": "denied_due_swidTagRevoked",
            "denialType": "swidTagRevoked",
            "denialReason": "swid-tag(unit-test-swTagId) revoked",
            "deniedAction": "acumos:deploy",
            "denialReqItemName": "swTagId",
            "denialReqItemValue": "unit-test-swTagId"
        }

----

license-profile not found ``denied_due_licenseProfileNotFound``
===============================================================

    .. code-block:: json
        :emphasize-lines: 2

        {
            "denialCode": "denied_due_licenseProfileNotFound",
            "denialType": "licenseProfileNotFound",
            "denialReason": "license-profile(b03ad842-c8d3-4138-b5f0-c33d77a0f87e) not found for swid-tag(unit-test-swTagId)",
            "deniedAction": "acumos:deploy",
            "denialReqItemName": "licenseProfileId",
            "denialReqItemValue": "b03ad842-c8d3-4138-b5f0-c33d77a0f87e"
        }

----

license-profile revoked ``denied_due_licenseProfileRevoked``
============================================================

    .. code-block:: json
        :emphasize-lines: 2

        {
            "denialCode": "denied_due_licenseProfileRevoked",
            "denialType": "licenseProfileNotFound",
            "denialReason": "license-profile(b03ad842-c8d3-4138-b5f0-c33d77a0f87e) not found for swid-tag(unit-test-swTagId)",
            "deniedAction": "acumos:deploy",
            "denialReqItemName": "licenseProfileId",
            "denialReqItemValue": "b03ad842-c8d3-4138-b5f0-c33d77a0f87e"
        }

----

agreement not found ``denied_due_agreementNotFound``
============================================================

    .. code-block:: json
        :emphasize-lines: 2

        {
            "denialCode": "denied_due_agreementNotFound",
            "denialType": "agreementNotFound",
            "denialReason": "swid-tag(unit-test-swTagId-2) has been found but no asset-usage-agreement from unit-test-softwareLicensorId-2 currently provide the right to use this asset for action(acumos:deploy)",
            "deniedAction": "acumos:deploy",
            "denialReqItemName": "softwareLicensorId",
            "denialReqItemValue": "unit-test-softwareLicensorId-2"
        }

----

                        -
right-to-use revoked ``denied_due_rightToUseRevoked``
=====================================================

    .. code-block:: json
        :emphasize-lines: 2

        {
            "denialCode": "denied_due_rightToUseRevoked",
            "denialType": "rightToUseRevoked",
            "denialReason": "rightToUse revoked on permission(unit-test-permission-1) under agreement(unit-test-assetUsageAgreementId) for action(acumos:deploy)",
            "deniedAction": "acumos:deploy",
            "deniedAssetUsageAgreementId": "unit-test-assetUsageAgreementId",
            "deniedAssetUsageAgreementRevision": 15,
            "deniedRightToUseId": "unit-test-permission-1",
            "deniedRightToUseRevision": 15,
            "denialReqItemName": "rightToUseActive",
            "denialReqItemValue": true
        }

----

Usage is prohibited ``denied_due_usageProhibited``
==================================================

    .. code-block:: json
        :emphasize-lines: 2

        {
            "denialCode": "denied_due_usageProhibited",
            "denialType": "usageProhibited",
            "denialReason": "swid-tag(unit-test-swTagId) has been found but asset-usage is prohibited by prohibition(unit-test-prohibition-2) under asset-usage-agreement(unit-test-assetUsageAgreementId) for action(acumos:deploy)",
            "deniedAction": "acumos:deploy",
            "deniedAssetUsageAgreementId": "unit-test-assetUsageAgreementId",
            "deniedAssetUsageAgreementRevision": 6,
            "deniedRightToUseId": "unit-test-prohibition-2",
            "deniedRightToUseRevision": 6,
            "denialReqItemName": "action",
            "denialReqItemValue": "acumos:deploy",
            "deniedConstraint": {
                "action": "acumos:deploy"
            }
        }

----

count unique users ``denied_due_countUniqueUsersOnAssignee``
============================================================

    .. code-block:: json
        :emphasize-lines: 2

        {
            "denialCode": "denied_due_countUniqueUsersOnAssignee",
            "denialType": "matchingConstraintOnAssignee",
            "denialReason": "too many users: (unit-test-userId-2 not in {\"users\": [\"unit-test-userId\"]}) on permission(unit-test-permission-1) under agreement(unit-test-assetUsageAgreementId) for action(acumos:deploy)",
            "deniedAction": "acumos:deploy",
            "deniedAssetUsageAgreementId": "unit-test-assetUsageAgreementId",
            "deniedAssetUsageAgreementRevision": 16,
            "deniedRightToUseId": "unit-test-permission-1",
            "deniedRightToUseRevision": 16,
            "denialReqItemName": "userId",
            "denialReqItemValue": "unit-test-userId-2",
            "deniedConstraint": {
                "dataType": "integer",
                "operator": "lteq",
                "leftOperand": "lum:countUniqueUsers",
                "rightOperand": 1
            },
            "deniedConstraintInvalid": false,
            "deniedMetrics": {
                "users": [
                    "unit-test-userId"
                ]
            }
        }

----

users ``denied_due_usersOnAssignee``
====================================

    .. code-block:: json
        :emphasize-lines: 2

        {
            "denialCode": "denied_due_usersOnAssignee",
            "denialType": "matchingConstraintOnAssignee",
            "denialReason": "user not in assignee lum:users: (unit-test-userId-2 not lum:in [\"alex\", \"justin\", \"michelle\", \"unit-test-userId\"]) on permission(unit-test-permission-1) under agreement(unit-test-assetUsageAgreementId) for action(acumos:deploy)",
            "deniedAction": "acumos:deploy",
            "deniedAssetUsageAgreementId": "unit-test-assetUsageAgreementId",
            "deniedAssetUsageAgreementRevision": 16,
            "deniedRightToUseId": "unit-test-permission-1",
            "deniedRightToUseRevision": 16,
            "denialReqItemName": "userId",
            "denialReqItemValue": "unit-test-userId-2",
            "deniedConstraint": {
                "origin": "fromRestriction",
                "dataType": "string",
                "operator": "lum:in",
                "leftOperand": "lum:users",
                "rightOperand": [
                    "alex",
                    "justin",
                    "michelle",
                    "unit-test-userId"
                ]
            },
            "deniedConstraintInvalid": false
        }

----

not targeted by swPersistentId ``denied_due_swPersistentIdOnTarget``
====================================================================

    .. code-block:: json
        :emphasize-lines: 2

        {
            "denialCode": "denied_due_swPersistentIdOnTarget",
            "denialType": "matchingConstraintOnTarget",
            "denialReason": "not targeted by lum:swPersistentId: (e2a90c73-f0a0-400d-a35d-0df36aa33b82 not lum:in [\"a218c795-ae2c-4ff9-894d-462baa768dfc\", \"cbf31f26-4590-4323-8991-000d9f290901\", \"fab0954c-d4e5-443a-8d3e-cf7620e80455\"]) on permission(unit-test-permission-1) under agreement(unit-test-assetUsageAgreementId) for action(acumos:deploy)",
            "deniedAction": "acumos:deploy",
            "deniedAssetUsageAgreementId": "unit-test-assetUsageAgreementId",
            "deniedAssetUsageAgreementRevision": 16,
            "deniedRightToUseId": "unit-test-permission-1",
            "deniedRightToUseRevision": 16,
            "denialReqItemName": "swPersistentId",
            "denialReqItemValue": "e2a90c73-f0a0-400d-a35d-0df36aa33b82",
            "deniedConstraint": {
                "dataType": "string",
                "operator": "lum:in",
                "leftOperand": "lum:swPersistentId",
                "rightOperand": [
                    "a218c795-ae2c-4ff9-894d-462baa768dfc",
                    "cbf31f26-4590-4323-8991-000d9f290901",
                    "fab0954c-d4e5-443a-8d3e-cf7620e80455"
                ]
            },
            "deniedConstraintInvalid": false
        }

----

not targeted by swTagId ``denied_due_swTagIdOnTarget``
======================================================

    .. code-block:: json
        :emphasize-lines: 2

        {
            "denialCode": "denied_due_swTagIdOnTarget",
            "denialType": "matchingConstraintOnTarget",
            "denialReason": "not targeted by lum:swTagId: (unit-test-swTagId-2 not lum:in [\"unit-test-swTagId\"]) on permission(unit-test-permission-1) under agreement(unit-test-assetUsageAgreementId) for action(acumos:deploy)",
            "deniedAction": "acumos:deploy",
            "deniedAssetUsageAgreementId": "unit-test-assetUsageAgreementId",
            "deniedAssetUsageAgreementRevision": 16,
            "deniedRightToUseId": "unit-test-permission-1",
            "deniedRightToUseRevision": 16,
            "denialReqItemName": "swTagId",
            "denialReqItemValue": "unit-test-swTagId-2",
            "deniedConstraint": {
                "dataType": "string",
                "operator": "lum:in",
                "leftOperand": "lum:swTagId",
                "rightOperand": [
                    "unit-test-swTagId"
                ]
            },
            "deniedConstraintInvalid": false
        }

----

not targeted by productName ``denied_due_swProductNameOnTarget``
================================================================

    .. code-block:: json
        :emphasize-lines: 2

        {
            "denialCode": "denied_due_swProductNameOnTarget",
            "denialType": "matchingConstraintOnTarget",
            "denialReason": "not targeted by lum:swProductName: (unit-test-product-2 not lum:in [\"unit-test-product253\"]) on permission(unit-test-permission-1) under agreement(unit-test-assetUsageAgreementId) for action(acumos:deploy)",
            "deniedAction": "acumos:deploy",
            "deniedAssetUsageAgreementId": "unit-test-assetUsageAgreementId",
            "deniedAssetUsageAgreementRevision": 16,
            "deniedRightToUseId": "unit-test-permission-1",
            "deniedRightToUseRevision": 16,
            "denialReqItemName": "swProductName",
            "denialReqItemValue": "unit-test-product-2",
            "deniedConstraint": {
                "dataType": "string",
                "operator": "lum:in",
                "leftOperand": "lum:swProductName",
                "rightOperand": [
                    "unit-test-product253"
                ]
            },
            "deniedConstraintInvalid": false
        }

----

not targeted by swCategory ``denied_due_swCategoryOnTarget``
============================================================

    .. code-block:: json
        :emphasize-lines: 2

        {
            "denialCode": "denied_due_swCategoryOnTarget",
            "denialType": "matchingConstraintOnTarget",
            "denialReason": "not targeted by lum:swCategory: (image-processing-2 not lum:in [\"image-processing\"]) on permission(unit-test-permission-1) under agreement(unit-test-assetUsageAgreementId) for action(acumos:deploy)",
            "deniedAction": "acumos:deploy",
            "deniedAssetUsageAgreementId": "unit-test-assetUsageAgreementId",
            "deniedAssetUsageAgreementRevision": 16,
            "deniedRightToUseId": "unit-test-permission-1",
            "deniedRightToUseRevision": 16,
            "denialReqItemName": "swCategory",
            "denialReqItemValue": "image-processing-2",
            "deniedConstraint": {
                "dataType": "string",
                "operator": "lum:in",
                "leftOperand": "lum:swCategory",
                "rightOperand": [
                    "image-processing"
                ]
            },
            "deniedConstraintInvalid": false
        }

----

not targeted by swCatalogId ``denied_due_swCatalogIdOnTarget``
==============================================================

    .. code-block:: json
        :emphasize-lines: 2

        {
            "denialCode": "denied_due_swCatalogIdOnTarget",
            "denialType": "matchingConstraintOnTarget",
            "denialReason": "not targeted by lum:swCatalogId: (none of [\"ABC models-2\",\"XYZ models-2\"] lum:in [\"XYZ models\"]) on permission(unit-test-permission-1) under agreement(unit-test-assetUsageAgreementId) for action(acumos:deploy)",
            "deniedAction": "acumos:deploy",
            "deniedAssetUsageAgreementId": "unit-test-assetUsageAgreementId",
            "deniedAssetUsageAgreementRevision": 16,
            "deniedRightToUseId": "unit-test-permission-1",
            "deniedRightToUseRevision": 16,
            "denialReqItemName": "swCatalogId",
            "denialReqItemValue": [
                "ABC models-2",
                "XYZ models-2"
            ],
            "deniedConstraint": {
                "dataType": "string",
                "operator": "lum:in",
                "leftOperand": "lum:swCatalogId",
                "rightOperand": [
                    "XYZ models"
                ]
            },
            "deniedConstraintInvalid": false
        }

----

not targeted by swCatalogType ``denied_due_swCatalogTypeOnTarget``
==================================================================

    .. code-block:: json
        :emphasize-lines: 2

        {
            "denialCode": "denied_due_swCatalogTypeOnTarget",
            "denialType": "matchingConstraintOnTarget",
            "denialReason": "not targeted by lum:swCatalogType: (none of [\"public\"] lum:in [\"restricted\"]) on permission(unit-test-permission-1) under agreement(unit-test-assetUsageAgreementId) for action(acumos:deploy)",
            "deniedAction": "acumos:deploy",
            "deniedAssetUsageAgreementId": "unit-test-assetUsageAgreementId",
            "deniedAssetUsageAgreementRevision": 16,
            "deniedRightToUseId": "unit-test-permission-1",
            "deniedRightToUseRevision": 16,
            "denialReqItemName": "swCatalogType",
            "denialReqItemValue": [
                "public"
            ],
            "deniedConstraint": {
                "dataType": "string",
                "operator": "lum:in",
                "leftOperand": "lum:swCatalogType",
                "rightOperand": [
                    "restricted"
                ]
            },
            "deniedConstraintInvalid": false
        }

----

rightToUse expired ``denied_due_expireOn``
==========================================

    .. code-block:: json
        :emphasize-lines: 2

        {
            "denialCode": "denied_due_expireOn",
            "denialType": "timingConstraint",
            "denialReason": "rightToUse expired: (today(2020-06-25) > expireOn(1999-12-31)) on permission(unit-test-permission-1) under agreement(unit-test-assetUsageAgreementId) for action(acumos:deploy)",
            "deniedAction": "acumos:deploy",
            "deniedAssetUsageAgreementId": "unit-test-assetUsageAgreementId",
            "deniedAssetUsageAgreementRevision": 7,
            "deniedRightToUseId": "unit-test-permission-1",
            "deniedRightToUseRevision": 7,
            "denialReqItemName": "date",
            "denialReqItemValue": "2020-06-25",
            "deniedConstraint": {
                "expireOn": "1999-12-31"
            }
        }

----

rightToUse expired ``denied_due_goodFor``
=========================================

    .. code-block:: json
        :emphasize-lines: 2

        {
            "denialCode": "denied_due_goodFor",
            "denialType": "timingConstraint",
            "denialReason": "rightToUse too late: (now(2020-06-25T17:44:13.745Z) > end-of-good-for(2020-06-25T17:44:13.737Z)), usage started(2020-05-26T17:44:13.737Z), was good for(30 days) on permission(unit-test-permission-1) under agreement(unit-test-assetUsageAgreementId) for action(acumos:deploy)",
            "deniedAction": "acumos:deploy",
            "deniedAssetUsageAgreementId": "unit-test-assetUsageAgreementId",
            "deniedAssetUsageAgreementRevision": 11,
            "deniedRightToUseId": "unit-test-permission-1",
            "deniedRightToUseRevision": 12,
            "denialReqItemName": "datetime",
            "denialReqItemValue": "2020-06-25T17:44:13.745Z",
            "deniedConstraint": {
                "leftOperand": "lum:goodFor",
                "operator": "lteq",
                "rightOperand": "P30D"
            },
            "deniedMetrics": {
                "usageStarted": "2020-05-26T17:44:13.737Z",
                "usageEnded": "2020-06-25T17:44:13.737Z"
            }
        }

----

rightToUse not enabled yet ``denied_due_enableOn``
==================================================

    .. code-block:: json
        :emphasize-lines: 2

        {
            "denialCode": "denied_due_enableOn",
            "denialType": "timingConstraint",
            "denialReason": "rightToUse not enabled yet: (today(2020-06-26) < enableOn(2029-01-02)) on permission(unit-test-permission-1) under agreement(unit-test-assetUsageAgreementId) for action(acumos:deploy)",
            "deniedAction": "acumos:deploy",
            "deniedAssetUsageAgreementId": "unit-test-assetUsageAgreementId",
            "deniedAssetUsageAgreementRevision": 17,
            "deniedRightToUseId": "unit-test-permission-1",
            "deniedRightToUseRevision": 17,
            "denialReqItemName": "date",
            "denialReqItemValue": "2020-06-26",
            "deniedConstraint": {
                "enableOn": "2029-01-02"
            }
        }

----

exceeding the usage count ``denied_due_usageCount``
===================================================

    .. code-block:: json
        :emphasize-lines: 2

        {
            "denialCode": "denied_due_usageCount",
            "denialType": "usageConstraint",
            "denialReason": "exceeding the usage count: (5 not lteq 4) on permission(unit-test-permission-1) under agreement(unit-test-assetUsageAgreementId) for action(acumos:deploy)",
            "deniedAction": "acumos:deploy",
            "deniedAssetUsageAgreementId": "unit-test-assetUsageAgreementId",
            "deniedAssetUsageAgreementRevision": 16,
            "deniedRightToUseId": "unit-test-permission-1",
            "deniedRightToUseRevision": 16,
            "denialReqItemName": "usageCount",
            "denialReqItemValue": 1,
            "deniedConstraint": {
                "dataType": "integer",
                "operator": "lteq",
                "leftOperand": "count",
                "rightOperand": 4
            },
            "deniedConstraintInvalid": false,
            "deniedMetrics": {
                "count": 4,
                "users": [
                    "unit-test-userId"
                ]
            }
        }

----

invalid constraint for ``denied_due_usageCount`` when ``rightOperand == null``
==============================================================================

    .. code-block:: json
        :emphasize-lines: 2,4,16,18

        {
            "denialCode": "denied_due_usageCount",
            "denialType": "usageConstraint",
            "denialReason": "invalid constraint count on permission(unit-test-permission-1) under agreement(unit-test-assetUsageAgreementId) for action(acumos:deploy)",
            "deniedAction": "acumos:deploy",
            "deniedAssetUsageAgreementId": "unit-test-assetUsageAgreementId",
            "deniedAssetUsageAgreementRevision": 13,
            "deniedRightToUseId": "unit-test-permission-1",
            "deniedRightToUseRevision": 13,
            "denialReqItemName": "usageCount",
            "denialReqItemValue": 2,
            "deniedConstraint": {
                "dataType": "integer",
                "operator": "lt",
                "leftOperand": "count",
                "rightOperand": null
            },
            "deniedConstraintInvalid": true,
            "deniedMetrics": {
                "count": 4,
                "users": [
                    "unit-test-userId"
                ]
            }
        }

----

:doc:`back to LUM index <index>`
