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
const snapshot = require('./snapshot');
const SqlParams = require('./sql-params');

const licenseProfileReq = {
    "licenseProfile"    : false,
    "isRtuRequired"     : true,
    "licenseTxt"        : false,
    "licenseName"       : false,
    "licenseDescription": false,
    "licenseNotes"      : false
};
const licenseProfileHouse = {
    "licenseProfileRevision": false,
    "licenseProfileActive"  : false,
    "creator"               : false,
    "created"               : false,
    "modifier"              : false,
    "modified"              : false,
    "closer"                : false,
    "closed"                : false,
    "closureReason"         : false
};

module.exports = {
    /**
     * get license-profile from database
     * @param  {} res
     */
    async getLicenseProfile(res) {
        if (Object.keys(res.locals.dbdata.licenseProfiles).every(lp => !lp)) {
            lumServer.logger.debug(res, `skipped getLicenseProfile(${JSON.stringify(res.locals.dbdata.licenseProfiles)})`);
            return;
        }
        lumServer.logger.debug(res, `in getLicenseProfile(${JSON.stringify(res.locals.dbdata.licenseProfiles)})`);

        const keys = new SqlParams();
        keys.setKeyValues("licenseProfileId", res.locals.dbdata.licenseProfiles);
        const selectFields = new SqlParams();
        selectFields.addFields(licenseProfileReq);
        selectFields.addFields(licenseProfileHouse);

        const sqlCmd = `SELECT ${keys.keyName}, ${selectFields.fields} FROM "licenseProfile"
                        WHERE ${keys.keyName} IN (${keys.idxValues}) FOR SHARE`;
        const result = await pgclient.sqlQuery(res, sqlCmd, keys.values);
        for (const licenseProfile of result.rows) {
            res.locals.dbdata.licenseProfiles[licenseProfile.licenseProfileId] = licenseProfile;
        }
        lumServer.logger.debug(res, `out getLicenseProfile(${JSON.stringify(res.locals.dbdata.licenseProfiles)})`);
    },
    /**
     * insert/update licenseProfile into database
     * @param  {} res
     */
    async putLicenseProfile(res) {
        const swidTag = utils.getFromReqByPath(res, "swidTag");
        const licenseProfile = utils.getFromReqByPath(res, "licenseProfile");

        if (!res.locals.params.licenseProfileId && licenseProfile) {
            res.locals.params.licenseProfileId = licenseProfile.licenseProfileId;
            res.set(res.locals.params);
        }

        if (!res.locals.params.licenseProfileId) {
            lumServer.logger.debug(res, `skipped putLicenseProfile(${res.locals.paramsStr})`);
            return;
        }
        lumServer.logger.debug(res, `in putLicenseProfile(${res.locals.paramsStr})`);

        const keys = new SqlParams();
        keys.addField("licenseProfileId", res.locals.params.licenseProfileId);
        const putFields = new SqlParams(keys);
        putFields.addFieldsFromBody(licenseProfileReq, licenseProfile);
        putFields.addField("softwareLicensorId", (swidTag || {}).softwareLicensorId);
        const houseFields = new SqlParams(putFields);
        houseFields.addField("licenseProfileActive", true);
        houseFields.addField("modifier", res.locals.params.userId);
        houseFields.addField("closer", null);
        houseFields.addField("closed", null);
        houseFields.addField("closureReason", null);

        const insFields = new SqlParams(houseFields);
        insFields.addField("creator", res.locals.params.userId);

        const sqlCmd = `INSERT INTO "licenseProfile" AS lp
            (${keys.fields} ${putFields.fields} ${houseFields.fields} ${insFields.fields}, "created", "modified")
            VALUES (${keys.idxValues} ${putFields.idxValues} ${houseFields.idxValues} ${insFields.idxValues}, NOW(), NOW())
            ON CONFLICT (${keys.fields}) DO UPDATE
            SET "licenseProfileRevision" = lp."licenseProfileRevision" + 1 ${putFields.updates} ${houseFields.updates}, "modified" = NOW()
            WHERE lp."licenseProfileActive" = FALSE OR ${putFields.getWhereDistinct("lp")}
            RETURNING *`;
        const result = await pgclient.sqlQuery(res, sqlCmd, keys.getAllValues());
        if (result.rows.length) {
            const snapshotBody = result.rows[0];
            await snapshot.storeSnapshot(res, snapshotBody.softwareLicensorId,
                "licenseProfile", res.locals.params.licenseProfileId,
                snapshotBody.licenseProfileRevision, snapshotBody);
        }
        lumServer.logger.debug(res, `out putLicenseProfile(${res.locals.paramsStr})`);
    },
    /**
     * mark the license-profile as active in the database
     * @param  {} res
     */
    async activateLicenseProfile(res) {
        if (!res.locals.params.swTagId) {
            lumServer.logger.debug(res, `skipped activateLicenseProfile(${res.locals.paramsStr})`);
            return;
        }
        lumServer.logger.debug(res, `in activateLicenseProfile(${res.locals.paramsStr})`);

        const keys = new SqlParams();
        keys.addField("swTagId", res.locals.params.swTagId);
        const houseFields = new SqlParams(keys);
        houseFields.addField("licenseProfileActive", true);
        houseFields.addField("modifier", res.locals.params.userId);
        houseFields.addField("closer", null);
        houseFields.addField("closed", null);
        houseFields.addField("closureReason", null);

        const sqlCmd = `WITH swt AS (SELECT "licenseProfileId" FROM "swidTag" WHERE ${keys.where} FOR SHARE)
            UPDATE "licenseProfile" AS lp
            SET "licenseProfileRevision" = lp."licenseProfileRevision" + 1 ${houseFields.updates}, "modified" = NOW()
            FROM swt WHERE lp."licenseProfileId" = swt."licenseProfileId" AND lp."licenseProfileActive" = FALSE
            RETURNING *`;
        const result = await pgclient.sqlQuery(res, sqlCmd, keys.getAllValues());
        if (result.rows.length) {
            const snapshotBody = result.rows[0];
            await snapshot.storeSnapshot(res, snapshotBody.softwareLicensorId,
                "licenseProfile", res.locals.params.licenseProfileId,
                snapshotBody.licenseProfileRevision, snapshotBody);
        }
        lumServer.logger.debug(res, `out activateLicenseProfile(${res.locals.paramsStr})`);
    }
}