-- ===================================================================
-- Copyright (c) 2019 AT&T Intellectual Property. All rights reserved.
-- ===================================================================
-- Unless otherwise specified, all software contained herein is licensed
-- under the Apache License, Version 2.0 (the "License");
-- you may not use this software except in compliance with the License.
-- You may obtain a copy of the License at
--
--             http://www.apache.org/licenses/LICENSE-2.0
--
-- Unless required by applicable law or agreed to in writing, software
-- distributed under the License is distributed on an "AS IS" BASIS,
-- WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
-- See the License for the specific language governing permissions and
-- limitations under the License.
-- ============LICENSE_END============================================

\connect lumdb lumdb;
-- \conninfo;
SELECT version();

DROP TABLE IF EXISTS "snapshot";
DROP TABLE IF EXISTS "assetUsageHistory";
DROP TABLE IF EXISTS "includedAssetUsage";
DROP TABLE IF EXISTS "assetUsage";
DROP TABLE IF EXISTS "matchingConstraint";
DROP TABLE IF EXISTS "usageConstraint";
DROP TABLE IF EXISTS "rtuUsage";
DROP TABLE IF EXISTS "assetUsageReq";
DROP TABLE IF EXISTS "swToRtu";
DROP TABLE IF EXISTS "rightToUse";
DROP TABLE IF EXISTS "assetUsageAgreement";
DROP TABLE IF EXISTS "swidTag";
DROP TABLE IF EXISTS "licenseProfile";
DROP TABLE IF EXISTS "swMgtSystem";


CREATE TABLE "swMgtSystem" (
    "swMgtSystemId"     TEXT NOT NULL PRIMARY KEY,
    --housekeeping--
    "creator"           TEXT NOT NULL DEFAULT USER,
    "created"           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "modifier"          TEXT NOT NULL DEFAULT USER,
    "modified"          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE "swMgtSystem" IS 'contains all settings per software management system like Acumos';
COMMENT ON COLUMN "swMgtSystem"."swMgtSystemId" IS 'like Acumos';
COMMENT ON COLUMN "swMgtSystem"."creator" IS 'userId of the creator';
COMMENT ON COLUMN "swMgtSystem"."created" IS 'when the record was created';
COMMENT ON COLUMN "swMgtSystem"."modifier" IS 'userId of the modifier';
COMMENT ON COLUMN "swMgtSystem"."modified" IS 'when the record was updated';

-- License Inventory --

CREATE TABLE "licenseProfile" (
    "licenseProfileId"          UUID NOT NULL PRIMARY KEY,
    "licenseProfile"            JSONB NULL,
    "isRtuRequired"             BOOLEAN NOT NULL DEFAULT TRUE,
    "licenseTxt"                TEXT NULL,
    "licenseName"               TEXT NULL,
    "licenseDescription"        TEXT NULL,
    "licenseNotes"              TEXT NULL,
    --housekeeping--
    "licenseProfileRevision"    INTEGER NOT NULL DEFAULT 1,
    "licenseProfileActive"      BOOLEAN NOT NULL DEFAULT TRUE,
    "creator"                   TEXT NOT NULL DEFAULT USER,
    "created"                   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "modifier"                  TEXT NOT NULL DEFAULT USER,
    "modified"                  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "closer"                    TEXT NULL,
    "closed"                    TIMESTAMP WITH TIME ZONE NULL,
    "closureReason"             TEXT NULL
);
COMMENT ON TABLE "licenseProfile" IS 'terms and conditions define the rights for managing the usage of the software asset';
COMMENT ON COLUMN "licenseProfile"."licenseProfileId" IS 'identifier of the license - can be shared between multiple swTagId';
COMMENT ON COLUMN "licenseProfile"."licenseProfile" IS 'full body of the license profile';
COMMENT ON COLUMN "licenseProfile"."isRtuRequired" IS 'whether requires the right-to-use for usage, when false goes directly to rtuUsage';
COMMENT ON COLUMN "licenseProfile"."licenseTxt" IS 'license.txt - humanly readable terms and conditions for the licenseProfile';
COMMENT ON COLUMN "licenseProfile"."licenseName" IS 'name of the license in free text';
COMMENT ON COLUMN "licenseProfile"."licenseDescription" IS 'desciption of the license in free text';
COMMENT ON COLUMN "licenseProfile"."licenseNotes" IS 'any textual notes';
COMMENT ON COLUMN "licenseProfile"."licenseProfileRevision" IS '1,2,3,... revision of the license - updates are allowed - auto-incremented by LUM';
COMMENT ON COLUMN "licenseProfile"."licenseProfileActive" IS 'whether the license profile is currently active - not closed and not expired and not revoked';
COMMENT ON COLUMN "licenseProfile"."creator" IS 'userId of the creator';
COMMENT ON COLUMN "licenseProfile"."created" IS 'when the record was created';
COMMENT ON COLUMN "licenseProfile"."modifier" IS 'userId of the modifier';
COMMENT ON COLUMN "licenseProfile"."modified" IS 'when the record was updated';
COMMENT ON COLUMN "licenseProfile"."closer" IS 'userId of the closer';
COMMENT ON COLUMN "licenseProfile"."closed" IS 'when the record was revoked-closed';
COMMENT ON COLUMN "licenseProfile"."closureReason" IS 'reason for the closure - revoked, expired, etc.';


CREATE TABLE "swidTag" (
    "swTagId"               TEXT NOT NULL PRIMARY KEY,
    "swPersistentId"        UUID NOT NULL,
    "swVersion"             TEXT NOT NULL,
    "swVersionComparable"   TEXT NULL,
    "licenseProfileId"      UUID NOT NULL REFERENCES "licenseProfile" ("licenseProfileId"),
    "softwareLicensorId"    TEXT NOT NULL,
    "swCategory"            TEXT NULL,
    "swCatalogs"            JSONB NULL,
    "swCreators"            TEXT[] NULL,
    "swProductName"         TEXT NULL,
    "swidTagDetails"        JSONB NULL,
    --housekeeping--
    "swidTagRevision"       INTEGER NOT NULL DEFAULT 1,
    "swidTagActive"         BOOLEAN NOT NULL DEFAULT TRUE,
    "creator"               TEXT NOT NULL DEFAULT USER,
    "created"               TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "modifier"              TEXT NOT NULL DEFAULT USER,
    "modified"              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "closer"                TEXT NULL,
    "closed"                TIMESTAMP WITH TIME ZONE NULL,
    "closureReason"         TEXT NULL
);
CREATE INDEX "idxSwidTagPersistent" ON "swidTag" ("swPersistentId", "swVersion");
CREATE INDEX "idxSwidTagLicenseProfile" ON "swidTag" ("licenseProfileId");
CREATE INDEX "idxSwidTagsoftwareLicensor" ON "swidTag" ("softwareLicensorId");

COMMENT ON TABLE "swidTag" IS 'software identification tag that is inspired by ISO/IEC 19770-2';
COMMENT ON COLUMN "swidTag"."swTagId" IS 'GUID+version -- identifier of the software up to specific version - revisionId in Acumos\n possible format: <swPersistentId>_<swVersion>. Example: "c0de3e70-e815-461f-9734-a239c450bf777.5.3.123-t1"';
COMMENT ON COLUMN "swidTag"."swPersistentId" IS 'versionless product-id that persiste between the version of the software. Example: "c0de3e70-e815-461f-9734-a239c450bf77"';
COMMENT ON COLUMN "swidTag"."swVersion" IS 'version of the software semver like "7.5.3.123-t1"';
COMMENT ON COLUMN "swidTag"."swVersionComparable" IS 'comparable value for the version of the software. Example for semver in comparable format: "00000007.00000005.00000003.00000123-t00000001"';
COMMENT ON COLUMN "swidTag"."licenseProfileId" IS 'identifier of the license profile attached to the software. FK to licenseProfile';
COMMENT ON COLUMN "swidTag"."softwareLicensorId" IS 'identifier of the supplier or owner of the software who provides the license profile and the right-to-use';
COMMENT ON COLUMN "swidTag"."swCategory" IS 'image processing, software, image, video, data. - used for matching to the right-to-use';
COMMENT ON COLUMN "swidTag"."swCatalogs" IS 'array of catalog info the software is stored in Acumos. [{"swCatalogId": "", -- uid for the catalog identifier\n "swCatalogType":"" -- restricted, company-wide, public, etc.}]';
COMMENT ON COLUMN "swidTag"."swCreators" IS 'collection of userId values of the creators for swidTag = superusers of the software';
COMMENT ON COLUMN "swidTag"."swProductName" IS 'product name like Windows';
COMMENT ON COLUMN "swidTag"."swidTagDetails" IS 'any other details: edition TEXT -- like Pro, Dev, Enterprise, Ultimate,\n revision TEXT -- build or revision number,\n marketVersion TEXT -- might differ from swVersion,\n patch BOOL -- indication that this is a patch,\n productUrl TEXT -- url to find more info at the licensor site';
COMMENT ON COLUMN "swidTag"."swidTagRevision" IS '1,2,3,... revision of the swidTag - updates are allowed - auto-incremented by LUM';
COMMENT ON COLUMN "swidTag"."swidTagActive" IS 'whether the record is not revoked-closed';
COMMENT ON COLUMN "swidTag"."creator" IS 'userId of the creator';
COMMENT ON COLUMN "swidTag"."created" IS 'when the record was created';
COMMENT ON COLUMN "swidTag"."modifier" IS 'userId of the modifier';
COMMENT ON COLUMN "swidTag"."modified" IS 'when the record was updated';
COMMENT ON COLUMN "swidTag"."closer" IS 'userId of the closer';
COMMENT ON COLUMN "swidTag"."closed" IS 'when the record was revoked-closed';
COMMENT ON COLUMN "swidTag"."closureReason" IS 'reason for the closure - revoked, expired, etc.';

-- Entitlement --
CREATE TABLE "assetUsageAgreement" (
    "assetUsageAgreementId"         TEXT NOT NULL PRIMARY KEY,
    "softwareLicensorId"            TEXT NOT NULL,
    --agreements details--
    "agreement"                     JSONB NOT NULL,
    "agreementRestriction"          JSONB NULL,
    --housekeeping--
    "assetUsageAgreementRevision"   INTEGER NOT NULL DEFAULT 1,
    "assetUsageAgreementActive"     BOOLEAN NOT NULL DEFAULT TRUE,
    "creator"                       TEXT NOT NULL DEFAULT USER,
    "created"                       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "modifier"                      TEXT NOT NULL DEFAULT USER,
    "modified"                      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "closer"                        TEXT NULL,
    "closed"                        TIMESTAMP WITH TIME ZONE NULL,
    "closureReason"                 TEXT NULL
);
CREATE INDEX "idxAssetUsageAgreementSoftwareLicensor" ON "assetUsageAgreement" ("softwareLicensorId");

COMMENT ON TABLE "assetUsageAgreement" IS 'collection of purchased rights-to-use/permissions - ODRL - Agreement https://www.w3.org/TR/odrl-model/#policy-agreement';
COMMENT ON COLUMN "assetUsageAgreement"."assetUsageAgreementId" IS 'UID key to assetUsageAgreement in IRI or URI format. possible format: "http://software-licensor/<softwareLicensorId>/agreement/<agreement-uuid>"';
COMMENT ON COLUMN "assetUsageAgreement"."softwareLicensorId" IS 'identifier of the supplier or owner of the software who provides the license profile and the right-to-use';
COMMENT ON COLUMN "assetUsageAgreement"."agreement" IS 'full body of ODRL agreement received from supplier';
COMMENT ON COLUMN "assetUsageAgreement"."agreementRestriction" IS 'full body of ODRL agreement restriction from the subscriber company';
COMMENT ON COLUMN "assetUsageAgreement"."assetUsageAgreementRevision" IS '1,2,3,... auto-incremented by LUM - revision - updates are allowed';
COMMENT ON COLUMN "assetUsageAgreement"."assetUsageAgreementActive" IS 'whether the record is not revoked-closed';
COMMENT ON COLUMN "assetUsageAgreement"."creator" IS 'userId of the creator';
COMMENT ON COLUMN "assetUsageAgreement"."created" IS 'when the record was created';
COMMENT ON COLUMN "assetUsageAgreement"."modifier" IS 'userId of the modifier';
COMMENT ON COLUMN "assetUsageAgreement"."modified" IS 'when the record was updated';
COMMENT ON COLUMN "assetUsageAgreement"."closer" IS 'userId of the closer';
COMMENT ON COLUMN "assetUsageAgreement"."closed" IS 'when the record was revoked-closed';
COMMENT ON COLUMN "assetUsageAgreement"."closureReason" IS 'reason for the closure - revoked, expired, etc.';

CREATE TABLE "rightToUse" (
    "rightToUseId"              TEXT NOT NULL PRIMARY KEY,
    "assetUsageAgreementId"     TEXT NOT NULL REFERENCES "assetUsageAgreement" ("assetUsageAgreementId"),
    "softwareLicensorId"        TEXT NOT NULL,
    "assetUsageRuleType"        TEXT NOT NULL DEFAULT 'permission',
    "assetUsageRule"            JSONB NOT NULL,
    "assetUsageRuleRestriction" JSONB NULL,
    "licenseKeys"               TEXT[] NULL,
    --timeframe extracted from constraints--
    "isPerpetual"               BOOLEAN NOT NULL DEFAULT FALSE,
    "enableOn"                  DATE NULL,
    "expireOn"                  DATE NULL,
    "goodFor"                   INTERVAL NULL,
    -- actual timeframe --
    "rtuUsageStarter"           TEXT NULL,
    "rtuUsageStarted"           TIMESTAMP WITH TIME ZONE NULL,
    "rtuUsageEnds"              TIMESTAMP WITH TIME ZONE NULL,
    --housekeeping--
    "rightToUseRevision"        INTEGER NOT NULL DEFAULT 1,
    "rightToUseActive"          BOOLEAN NOT NULL DEFAULT TRUE,
    "creator"                   TEXT NOT NULL DEFAULT USER,
    "created"                   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "modifier"                  TEXT NOT NULL DEFAULT USER,
    "modified"                  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "closer"                    TEXT NULL,
    "closed"                    TIMESTAMP WITH TIME ZONE NULL,
    "closureReason"             TEXT NULL
);
CREATE INDEX "idxRightToUseSoftwareLicensor" ON "rightToUse" ("softwareLicensorId");

COMMENT ON TABLE "rightToUse" IS 'in ODRL this is a permission rule for matching and usage rights for specific software assets';
COMMENT ON COLUMN "rightToUse"."rightToUseId" IS 'UID key to rightToUse in IRI or URI format. possible format: "http://software-licensor/<softwareLicensorId>/permission/<permission-uuid>"';
COMMENT ON COLUMN "rightToUse"."assetUsageAgreementId" IS 'identifier of the parent assetUsageAgreement';
COMMENT ON COLUMN "rightToUse"."softwareLicensorId" IS 'identifier of the supplier or owner of the software who provides the license profile and the right-to-use';
COMMENT ON COLUMN "rightToUse"."assetUsageRuleType" IS 'ENUM {permission, prohibition, obligation} -- see ODRL';
COMMENT ON COLUMN "rightToUse"."assetUsageRule" IS 'full body of ODRL permission received from supplier.  {assigner -- identifier of the supplier\n assignee -- identifier of the user or users\n target -- ODRL structure to identify the target - the matching asset collection with refinement,\n action, constraint, logicalConstraint, ...}';
COMMENT ON COLUMN "rightToUse"."assetUsageRuleRestriction" IS 'ODRL permission restriction from the subscriber company - company specific constraints on the permission like the list of unique user-ids on assignee';
COMMENT ON COLUMN "rightToUse"."licenseKeys" IS '[licenseKey] - list of license-keys provided by supplier are consumed by the software to unlock the functionality';
COMMENT ON COLUMN "rightToUse"."isPerpetual" IS 'extracted from assetUsageRule: never expires if true';
COMMENT ON COLUMN "rightToUse"."enableOn" IS 'when the asset-usage by assetUsageAgreement becomes enabled GMT';
COMMENT ON COLUMN "rightToUse"."expireOn" IS 'when the asset-usage by assetUsageAgreement expires GMT';
COMMENT ON COLUMN "rightToUse"."goodFor" IS 'timeperiod in seconds for entitled asset-usage. Example: 30 days == 2592000 secs';
COMMENT ON COLUMN "rightToUse"."rtuUsageStarter" IS 'userId of the rightToUse starter';
COMMENT ON COLUMN "rightToUse"."rtuUsageStarted" IS 'populated on first start of the usage';
COMMENT ON COLUMN "rightToUse"."rtuUsageEnds" IS 'rtuUsageStarted + goodFor';
COMMENT ON COLUMN "rightToUse"."rightToUseRevision" IS '1,2,3,... auto-incremented by LUM - revision - updates are allowed';
COMMENT ON COLUMN "rightToUse"."rightToUseActive" IS 'whether rightToUse is enabled and not revoked-closed or expired';
COMMENT ON COLUMN "rightToUse"."creator" IS 'userId of the creator';
COMMENT ON COLUMN "rightToUse"."created" IS 'when the record was created';
COMMENT ON COLUMN "rightToUse"."modifier" IS 'userId of the modifier';
COMMENT ON COLUMN "rightToUse"."modified" IS 'when the record was updated';
COMMENT ON COLUMN "rightToUse"."closer" IS 'userId of the closer';
COMMENT ON COLUMN "rightToUse"."closed" IS 'when the record was revoked-closed';
COMMENT ON COLUMN "rightToUse"."closureReason" IS 'reason for the closure - revoked, expired, etc.';

CREATE TABLE "matchingConstraint" (
    "rightToUseId"          TEXT NOT NULL REFERENCES "rightToUse" ("rightToUseId"),
    "matchingConstraintId"  TEXT NOT NULL,
    "constraintScope"       TEXT NOT NULL,
    "isRestriction"         BOOLEAN NOT NULL DEFAULT FALSE,
    "leftOperand"           TEXT NOT NULL,
    "operator"              TEXT NOT NULL,
    "rightOperand"          JSONB NOT NULL,
    "dataType"              TEXT NOT NULL,
    "unit"                  TEXT NULL,
    --usage metrics--
    "status"                JSONB NULL,
    --housekeeping--
    "creator"               TEXT NOT NULL DEFAULT USER,
    "created"               TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "metricsModifier"       TEXT NULL,
    "metricsModified"       TIMESTAMP WITH TIME ZONE NULL,
    "constraintModifier"    TEXT NULL,
    "constraintModified"    TIMESTAMP WITH TIME ZONE NULL,
    PRIMARY KEY ("rightToUseId", "matchingConstraintId")
);
COMMENT ON TABLE "matchingConstraint" IS 'refinements on target and assignee and timing constraints on permission per rightToUse';
COMMENT ON COLUMN "matchingConstraint"."rightToUseId" IS 'identifier of the rightToUse';
COMMENT ON COLUMN "matchingConstraint"."matchingConstraintId" IS 'uid for matchingConstraint. possible format: "http://software-licensor/<softwareLicensorId>/constraint/<constraint-uuid>"';
COMMENT ON COLUMN "matchingConstraint"."constraintScope" IS 'ENUM {onTarget, onAssignee, onRule, matchingStandalone} -- scope of the matchingConstraint';
COMMENT ON COLUMN "matchingConstraint"."isRestriction" IS 'when true, it is coming from agreementRestriction';
COMMENT ON COLUMN "matchingConstraint"."leftOperand" IS 'ENUM {"lum:countUniqueUsers", "lum:users", date, "lum:goodFor", + targets} -- type of metrics or expression to be compared to the limit';
COMMENT ON COLUMN "matchingConstraint"."operator" IS 'ENUM {lt, lteq, eq, gt, gteq} -- comparison operator between the leftOperand and rightOperand';
COMMENT ON COLUMN "matchingConstraint"."rightOperand" IS 'value of the constraint {"@value":<integer>/<string>/[<value>]}';
COMMENT ON COLUMN "matchingConstraint"."dataType" IS 'ENUM {integer, boolean, date, interval, json} -- type of data in rightOperand';
COMMENT ON COLUMN "matchingConstraint"."unit" IS 'unit the rightOperand is measured in';
COMMENT ON COLUMN "matchingConstraint"."status" IS 'value of the metrics - can be {"@count":<integer>} or {<value>:true} (value=userId to track unique users)';
COMMENT ON COLUMN "matchingConstraint"."creator" IS 'userId of the creator';
COMMENT ON COLUMN "matchingConstraint"."created" IS 'when the record was created';
COMMENT ON COLUMN "matchingConstraint"."metricsModifier" IS 'userId of the metrics modifier';
COMMENT ON COLUMN "matchingConstraint"."metricsModified" IS 'when the metrics was updated';
COMMENT ON COLUMN "matchingConstraint"."constraintModifier" IS 'userId of the modifier of the right';
COMMENT ON COLUMN "matchingConstraint"."constraintModified" IS 'when updated the asset usage right-limit';

CREATE TABLE "swToRtu" (
    "swTagId"               TEXT NOT NULL REFERENCES "swidTag" ("swTagId") ON DELETE CASCADE ON UPDATE CASCADE,
    "action"                TEXT NOT NULL,
    "rightToUseId"          TEXT NOT NULL REFERENCES "rightToUse" ("rightToUseId") ON DELETE CASCADE ON UPDATE CASCADE,
    --matching up to revision--
    "swidTagRevision"       INTEGER NOT NULL,
    "rightToUseRevision"    INTEGER NOT NULL,
    PRIMARY KEY ("swTagId", "rightToUseId")
);
CREATE INDEX "idxSwToRtu" ON "swToRtu" ("rightToUseId", "action", "swTagId");

COMMENT ON TABLE "swToRtu" IS 'join for many-to-many between rightToUse and swidTag. for the same or different software product of one or more software versions -- multiple swTagId per rightToUseId like for versions 8.0, 8.1, 8.3';
COMMENT ON COLUMN "swToRtu"."swTagId" IS 'GUID+version -- identifier of the software up to specific version';
COMMENT ON COLUMN "swToRtu"."action" IS 'download, deploy, execute, ...';
COMMENT ON COLUMN "swToRtu"."rightToUseId" IS 'identifier of the rightToUse';
COMMENT ON COLUMN "swToRtu"."swidTagRevision" IS '1,2,3,... revision of the swidTag';
COMMENT ON COLUMN "swToRtu"."rightToUseRevision" IS '1,2,3,... revision of the rightToUse = assetUsageAgreement';

-- AUM --
CREATE TABLE "assetUsageReq" (
    "assetUsageReqId"           UUID NOT NULL PRIMARY KEY,
    "action"                    TEXT NOT NULL,
    "assetUsageType"            TEXT NOT NULL DEFAULT 'assetUsage',
    "requestHttp"               JSON NOT NULL,
    "request"                   JSON NOT NULL,
    "responseHttpCode"          INTEGER NULL,
    "response"                  JSON NULL,
    "usageEntitled"             BOOLEAN NULL,
    --housekeeping--
    "status"                    TEXT NOT NULL,
    "requestStarted"            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "requestDone"               BOOLEAN NOT NULL DEFAULT FALSE,
    "responseSent"              TIMESTAMP WITH TIME ZONE NULL
);

COMMENT ON TABLE "assetUsageReq" IS 'request received by LUM for granting the entitlement for the asset usage or record the event. can be more than one asset when other assets are included';
COMMENT ON COLUMN "assetUsageReq"."assetUsageReqId" IS 'identifier of the assetUsageReq - identifier of request that inserted the assetUsageHistory';
COMMENT ON COLUMN "assetUsageReq"."action" IS 'download, deploy, execute, ...';
COMMENT ON COLUMN "assetUsageReq"."assetUsageType" IS 'ENUM {assetUsage, assetUsageEvent}';
COMMENT ON COLUMN "assetUsageReq"."requestHttp" IS 'http method+urlPath part of the request. {> method TEXT -- put, delete, post\n path TEXT -- path in url like "/asset-usage/{assetUsageId}"\n ips TEXT[] -- ip-addresses of the http client, ...}';
COMMENT ON COLUMN "assetUsageReq"."request" IS 'full copy of request message - see API for more details';
COMMENT ON COLUMN "assetUsageReq"."responseHttpCode" IS '200 for success, 224 for revoked, 402 for denial';
COMMENT ON COLUMN "assetUsageReq"."response" IS 'usage assetUsageAgreement result full copy of response message - see API for more details';
COMMENT ON COLUMN "assetUsageReq"."usageEntitled" IS 'whether the action on the request has been entitled (true) or not (false) by LUM';
COMMENT ON COLUMN "assetUsageReq"."status" IS 'ENUM {entitled, denied, eventRecorded, ...}';
COMMENT ON COLUMN "assetUsageReq"."requestStarted" IS 'when the request processing started = this record is created';
COMMENT ON COLUMN "assetUsageReq"."requestDone" IS 'true on sending the response = this record is updated';
COMMENT ON COLUMN "assetUsageReq"."responseSent" IS 'when the response was sent = this record is updated';

-- AUM - rtuUsage --
CREATE TABLE "rtuUsage" (
    "rtuUsageId"            TEXT NOT NULL,
    "action"                TEXT NOT NULL,
    "rtuType"               TEXT NOT NULL,
    "rightToUseId"          TEXT NULL,
    "licenseKeys"           TEXT[] NULL,
    "logicalConstraints"    JSONB NULL,
    --housekeeping--
    "rtuUsageRevision"      INTEGER NOT NULL DEFAULT 1,
    "rtuUsageActive"        BOOLEAN NOT NULL DEFAULT TRUE,
    "creator"               TEXT NOT NULL DEFAULT USER,
    "created"               TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "modifier"              TEXT NOT NULL DEFAULT USER,
    "modified"              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "closer"                TEXT NULL,
    "closed"                TIMESTAMP WITH TIME ZONE NULL,
    "closureReason"         TEXT NULL,
    PRIMARY KEY ("rtuUsageId", "action")
);
COMMENT ON TABLE "rtuUsage" IS 'usage per single RTU+action on each asset separately.\n contains constraints with status-metrics onRule and onRuleStandalone.\n for rtuType == rightToUse -> rtuUsageId == rightToUse.rightToUseId FK to rightToUse\n for rtuType == byCreator -> rtuUsageId == swidTag.swTagId FK to swidTag\n for rtuType == freeToUse -> rtuUsageId == swidTag.swTagId FK to swidTag';
COMMENT ON COLUMN "rtuUsage"."rtuUsageId" IS 'identifier of the rtuUsage - for rtuType == rightToUse -> rtuUsageId == rightToUse.rightToUseId FK to rightToUse.\n for rtuType == byCreator -> rtuUsageId == swidTag.swTagId FK to swidTag.\n for rtuType == freeToUse -> rtuUsageId == swidTag.swTagId FK to swidTag';
COMMENT ON COLUMN "rtuUsage"."action" IS 'download, deploy, execute, ...';
COMMENT ON COLUMN "rtuUsage"."rtuType" IS 'ENUM {rightToUse, byCreator, freeToUse} -- how the rtuUsage is created';
COMMENT ON COLUMN "rtuUsage"."rightToUseId" IS 'identifier of the rightToUse for rtuType=rightToUse';
COMMENT ON COLUMN "rtuUsage"."licenseKeys" IS '[licenseKey] - copied from rightToUse - list of license-keys provided by supplier are consumed by the software to unlock the functionality';
COMMENT ON COLUMN "rtuUsage"."logicalConstraints" IS 'logicalConstraints over usageConstraint of onRuleStandalone -- see ODRL for more info';
COMMENT ON COLUMN "rtuUsage"."rtuUsageRevision" IS '1,2,3,... auto-incremented by LUM - revision - updates are allowed';
COMMENT ON COLUMN "rtuUsage"."rtuUsageActive" IS 'whether rtuUsage is started, but not ended-closed or expired';
COMMENT ON COLUMN "rtuUsage"."creator" IS 'userId of the creator';
COMMENT ON COLUMN "rtuUsage"."created" IS 'when the record was created';
COMMENT ON COLUMN "rtuUsage"."modifier" IS 'userId of the modifier';
COMMENT ON COLUMN "rtuUsage"."modified" IS 'when the record was updated';
COMMENT ON COLUMN "rtuUsage"."closer" IS 'userId of the closer';
COMMENT ON COLUMN "rtuUsage"."closed" IS 'when the record was revoked-closed';
COMMENT ON COLUMN "rtuUsage"."closureReason" IS 'reason for the closure - revoked, expired, etc.';

-- AURM --
CREATE TABLE "usageConstraint" (
    "rtuUsageId"            TEXT NOT NULL,
    "action"                TEXT NOT NULL,
    "usageConstraintId"     TEXT NOT NULL,
    "constraintScope"       TEXT NOT NULL,
    "isRestriction"         BOOLEAN NOT NULL DEFAULT FALSE,
    "leftOperand"           TEXT NOT NULL,
    "operator"              TEXT NOT NULL,
    "rightOperand"          JSONB NOT NULL,
    "dataType"              TEXT NOT NULL,
    "unit"                  TEXT NULL,
    --usage metrics--
    "status"                JSONB NULL,
    --housekeeping--
    "creator"               TEXT NOT NULL DEFAULT USER,
    "created"               TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "metricsModifier"       TEXT NULL,
    "metricsModified"       TIMESTAMP WITH TIME ZONE NULL,
    "constraintModifier"    TEXT NULL,
    "constraintModified"    TIMESTAMP WITH TIME ZONE NULL,
    PRIMARY KEY ("rtuUsageId", "action", "usageConstraintId"),
    FOREIGN KEY ("rtuUsageId", "action") REFERENCES "rtuUsage" ("rtuUsageId", "action")
);
COMMENT ON TABLE "usageConstraint" IS 'constraint and metrics per single action per single permission/prohibition';
COMMENT ON COLUMN "usageConstraint"."rtuUsageId" IS 'identifier of the rtuUsage';
COMMENT ON COLUMN "usageConstraint"."action" IS 'download, deploy, execute, ...';
COMMENT ON COLUMN "usageConstraint"."usageConstraintId" IS 'uid for usageConstraint';
COMMENT ON COLUMN "usageConstraint"."constraintScope" IS 'ENUM {onRule, onRuleStandalone} -- scope of the usageConstraint';
COMMENT ON COLUMN "usageConstraint"."isRestriction" IS 'when true, it is coming from agreementRestriction';
COMMENT ON COLUMN "usageConstraint"."leftOperand" IS 'ENUM {count} -- metrics or expression to be compared to the limit';
COMMENT ON COLUMN "usageConstraint"."operator" IS 'ENUM {lt, lteq, eq, gt, gteq} -- comparison operator between the leftOperand and rightOperand';
COMMENT ON COLUMN "usageConstraint"."rightOperand" IS 'value of the constraint {"@value":<integer>/<string>/[<value>]}';
COMMENT ON COLUMN "usageConstraint"."dataType" IS 'ENUM {integer, boolean, date, interval, json} -- type of data in rightOperand';
COMMENT ON COLUMN "usageConstraint"."unit" IS 'unit the rightOperand is measured in';
COMMENT ON COLUMN "usageConstraint"."status" IS 'value of the metrics - can be {"@count":<integer>} or {<value>:true} (value=userId to track unique users)';
COMMENT ON COLUMN "usageConstraint"."creator" IS 'userId of the creator';
COMMENT ON COLUMN "usageConstraint"."created" IS 'when the record was created';
COMMENT ON COLUMN "usageConstraint"."metricsModifier" IS 'userId of the metrics modifier';
COMMENT ON COLUMN "usageConstraint"."metricsModified" IS 'when the metrics was updated';
COMMENT ON COLUMN "usageConstraint"."constraintModifier" IS 'userId of the modifier of the right';
COMMENT ON COLUMN "usageConstraint"."constraintModified" IS 'when updated the asset usage right-limit';

-- AUT --
CREATE TABLE "assetUsage" (
    "assetUsageId"                  TEXT NOT NULL PRIMARY KEY,
    "isIncludedAsset"               BOOLEAN NOT NULL DEFAULT FALSE,
    --tails of history--
    "assetUsageSeqTail"             INTEGER NOT NULL DEFAULT 0,
    "assetUsageSeqTailEntitled"     INTEGER NULL,
    "assetUsageSeqTailEntitlement"  INTEGER NULL,
    "assetUsageSeqTailEvent"        INTEGER NULL,
    --housekeeping--
    "creator"                       TEXT NOT NULL DEFAULT USER,
    "created"                       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "modifier"                      TEXT NOT NULL DEFAULT USER,
    "modified"                      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE "assetUsage" IS 'usage of the software asset by users';
COMMENT ON COLUMN "assetUsage"."assetUsageId" IS 'identifier of the assetUsage - FK1 to assetUsageHistory';
COMMENT ON COLUMN "assetUsage"."isIncludedAsset" IS 'included asset (true), master asset (false)';
COMMENT ON COLUMN "assetUsage"."assetUsageSeqTail" IS 'sequential number 1,2,3,... - auto-incremented by LUM - FK2 to tail record on assetUsageHistory';
COMMENT ON COLUMN "assetUsage"."assetUsageSeqTailEntitled" IS 'FK2 to assetUsageHistory for last successful entitlement in assetUsageHistory';
COMMENT ON COLUMN "assetUsage"."assetUsageSeqTailEntitlement" IS 'FK2 to assetUsageHistory for last entitlement';
COMMENT ON COLUMN "assetUsage"."assetUsageSeqTailEvent" IS 'FK2 to assetUsageHistory for last event';
COMMENT ON COLUMN "assetUsage"."creator" IS 'userId of the creator';
COMMENT ON COLUMN "assetUsage"."created" IS 'when the record was created';
COMMENT ON COLUMN "assetUsage"."modifier" IS 'userId of the modifier';
COMMENT ON COLUMN "assetUsage"."modified" IS 'when the record was updated';

CREATE TABLE "includedAssetUsage" (
    "assetUsageId"          TEXT NOT NULL REFERENCES "assetUsage" ("assetUsageId"),
    "includedAssetUsageId"  TEXT NOT NULL REFERENCES "assetUsage" ("assetUsageId"),
    --housekeeping--
    "creator"               TEXT NOT NULL DEFAULT USER,
    "created"               TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    PRIMARY KEY ("assetUsageId", "includedAssetUsageId")
);
CREATE UNIQUE INDEX "uidxIncludedAssetUsage" ON "includedAssetUsage" ("includedAssetUsageId", "assetUsageId");

COMMENT ON TABLE "includedAssetUsage" IS 'when software piece is either copied-included or composed of other software pieces';
COMMENT ON COLUMN "includedAssetUsage"."assetUsageId" IS 'identifier of the assetUsage';
COMMENT ON COLUMN "includedAssetUsage"."includedAssetUsageId" IS 'identifier of the assetUsage for the included asset';
COMMENT ON COLUMN "includedAssetUsage"."creator" IS 'userId of the creator';
COMMENT ON COLUMN "includedAssetUsage"."created" IS 'when action happened - record created';

CREATE TABLE "assetUsageHistory" (
    "assetUsageId"                  TEXT NOT NULL REFERENCES "assetUsage" ("assetUsageId"),
    "assetUsageSeq"                 INTEGER NOT NULL DEFAULT 1,
    "assetUsageType"                TEXT NOT NULL DEFAULT 'assetUsage',
    "assetUsageReqId"               UUID NOT NULL REFERENCES "assetUsageReq" ("assetUsageReqId"),
    "softwareLicensorId"            TEXT NULL,
    "swTagId"                       TEXT NULL,
    "swidTagRevision"               INTEGER NULL,
    "licenseProfileId"              UUID NULL,
    "licenseProfileRevision"        INTEGER NULL,
    "isRtuRequired"                 BOOLEAN NULL,
    "rtuUsageId"                    TEXT NULL,
    "action"                        TEXT NOT NULL,
    "rightToUseId"                  TEXT NULL,
    "rightToUseRevision"            INTEGER NULL,
    "assetUsageAgreementId"         TEXT NULL,
    "assetUsageAgreementRevision"   INTEGER NULL,
    "swMgtSystemId"                 TEXT NULL,
    "swMgtSystemInstanceId"         TEXT NULL,
    "swMgtSystemComponent"          TEXT NULL,
    --results--
    "usageEntitled"                 BOOLEAN NULL,
    "isSwCreator"                   BOOLEAN NULL,
    "licenseKeys"                   TEXT[] NULL,
    "assetUsageDenial"              JSON NULL,
    --housekeeping--
    "creator"                       TEXT NOT NULL DEFAULT USER,
    "created"                       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    PRIMARY KEY ("assetUsageId", "assetUsageSeq")
);
CREATE INDEX "idxAssetUsageHistorySoftwareLicensor" ON "assetUsageHistory" ("softwareLicensorId");

COMMENT ON TABLE "assetUsageHistory" IS 'history of the usage of the software asset. can only insert - never update or delete to this table';
COMMENT ON COLUMN "assetUsageHistory"."assetUsageId" IS 'identifier of the assetUsage';
COMMENT ON COLUMN "assetUsageHistory"."assetUsageSeq" IS 'sequential number 1,2,3,... - auto-incremented by LUM';
COMMENT ON COLUMN "assetUsageHistory"."assetUsageType" IS 'ENUM {assetUsage, assetUsageEvent}';
COMMENT ON COLUMN "assetUsageHistory"."assetUsageReqId" IS 'identifier of the assetUsageReq - identifier of request that inserted the assetUsageHistory';
COMMENT ON COLUMN "assetUsageHistory"."softwareLicensorId" IS 'identifier of the supplier or owner of the software who provides the license profile and the right-to-use';
COMMENT ON COLUMN "assetUsageHistory"."swTagId" IS 'GUID+version -- identifier of the software up to specific version';
COMMENT ON COLUMN "assetUsageHistory"."swidTagRevision" IS '1,2,3,... revision of the swidTag - updates are allowed - auto-incremented by LUM';
COMMENT ON COLUMN "assetUsageHistory"."licenseProfileId" IS 'identifier of the license profile attached to the software';
COMMENT ON COLUMN "assetUsageHistory"."licenseProfileRevision" IS '1,2,3,... revision of the license - updates are allowed - auto-incremented by LUM';
COMMENT ON COLUMN "assetUsageHistory"."isRtuRequired" IS 'whether requires the right-to-use for usage';
COMMENT ON COLUMN "assetUsageHistory"."rtuUsageId" IS 'identifier of the rtuUsage';
COMMENT ON COLUMN "assetUsageHistory"."action" IS 'download, publish, execute, monitor, ...';
COMMENT ON COLUMN "assetUsageHistory"."rightToUseId" IS 'identifier of the rightToUse for rtuType=rightToUse';
COMMENT ON COLUMN "assetUsageHistory"."rightToUseRevision" IS '1,2,3,... revision of rightToUse';
COMMENT ON COLUMN "assetUsageHistory"."assetUsageAgreementId" IS 'FK to assetUsageAgreement';
COMMENT ON COLUMN "assetUsageHistory"."assetUsageAgreementRevision" IS '1,2,3,... revision of assetUsageAgreement';
COMMENT ON COLUMN "assetUsageHistory"."swMgtSystemId" IS 'like Acumos';
COMMENT ON COLUMN "assetUsageHistory"."swMgtSystemInstanceId" IS 'system instance id that manages the software pieces and sent the request - like "Acumos#22"';
COMMENT ON COLUMN "assetUsageHistory"."swMgtSystemComponent" IS 'component inside the system that sent the request like "model-runner"';
COMMENT ON COLUMN "assetUsageHistory"."usageEntitled" IS 'whether the asset-usage entitled (true) or not (false)';
COMMENT ON COLUMN "assetUsageHistory"."isSwCreator" IS 'whether the userId listed in swCreators of the software';
COMMENT ON COLUMN "assetUsageHistory"."licenseKeys" IS '[licenseKey] - copied from rtuUsage - list of license-keys provided by supplier are consumed by the software to unlock the functionality';
COMMENT ON COLUMN "assetUsageHistory"."assetUsageDenial" IS 'denials of the usage of the software asset - see API';
COMMENT ON COLUMN "assetUsageHistory"."creator" IS 'userId of the record creator';
COMMENT ON COLUMN "assetUsageHistory"."created" IS 'when action happened - record created';

-- snapshot --
CREATE TABLE "snapshot" (
    "snapshotType"      TEXT NOT NULL,
    "snapshotKey"       TEXT NOT NULL,
    "snapshotRevision"  INTEGER NOT NULL,
    "snapshotBody"      JSON NOT NULL,
    --housekeeping--
    "creator"           TEXT NOT NULL DEFAULT USER,
    "created"           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    PRIMARY KEY ("snapshotType", "snapshotKey", "snapshotRevision")
);

COMMENT ON TABLE "snapshot" IS 'historical snapshots of any data';
COMMENT ON COLUMN "snapshot"."snapshotType" IS 'ENUM {licenseProfile, swidTag, assetUsageAgreement, rightToUse}';
COMMENT ON COLUMN "snapshot"."snapshotKey" IS 'PK to the source table like swTagId';
COMMENT ON COLUMN "snapshot"."snapshotRevision" IS 'revision field on the source table like swidTagRevision';
COMMENT ON COLUMN "snapshot"."snapshotBody" IS 'copy of the full record from source table';
COMMENT ON COLUMN "snapshot"."creator" IS 'userId of the creator';
COMMENT ON COLUMN "snapshot"."created" IS 'when snapshot happened - record created';

-- end --
