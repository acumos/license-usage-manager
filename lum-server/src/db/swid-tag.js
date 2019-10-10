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

// const swidTagKey = {"swTagId": true};
// {required: true, type: "array", ref: "swCategory"};
const swidTagReq = {
    "swPersistentId"        : true,
    "swVersion"             : true,
    "swVersionComparable"   : true,
    "licenseProfileId"      : true,
    "softwareLicensorId"    : true,
    "swCategory"            : false,
    "swCreators"            : false,
    "swProductName"         : false,
    "swidTagDetails"        : false
};
// const swidTagCreatorsReq = {
//     "swCreators" : true
// };
const swidTagHouse = {
    "swidTagRevision" : false,
    "swidTagActive"   : false,
    "creator"         : false,
    "created"         : false,
    "modifier"        : false,
    "modified"        : false,
    "closer"          : false,
    "closed"          : false,
    "closureReason"   : false
};


module.exports = {
    /**
     * get swid-tag from database
     * @param  {} res
     */
    async getSwidTag(res) {
        utils.logInfo(res, `in getSwidTag(${JSON.stringify(res.locals.dbdata.swidTags)})`);

        const keys = new SqlParams();
        keys.setKeyValues("swTagId", res.locals.dbdata.swidTags);
        const selectFields = new SqlParams();
        selectFields.addFields(swidTagReq);
        selectFields.addField("swCatalogs", true);
        selectFields.addFields(swidTagHouse);

        const sqlCmd = `SELECT ${keys.keyName}, ${selectFields.fields} FROM "swidTag"
                         WHERE ${keys.keyName} IN (${keys.idxValues}) FOR SHARE`;
        const result = await pgclient.sqlQuery(res, sqlCmd, keys.values);
        for (const swidTag of result.rows) {
            res.locals.dbdata.swidTags[swidTag.swTagId].swidTagBody        = swidTag;
            res.locals.dbdata.licenseProfiles[swidTag.licenseProfileId] = null;
        }
        utils.logInfo(res, `out getSwidTag(${JSON.stringify(res.locals.dbdata.swidTags)})`);
    },
    /**
     * revoke swid-tag in the database
     * @param  {} res
     */
    async revokeSwidTag(res) {
        utils.logInfo(res, `in revokeSwidTag(${res.locals.params.swTagId})`);
        const keys = new SqlParams();
        keys.addField("swTagId", res.locals.params.swTagId);
        const putFields = new SqlParams(keys);
        putFields.addField("swidTagActive", false);
        putFields.addField("closer", res.locals.params.userId);
        putFields.addField("closureReason", "revoked");

        const sqlCmd = `UPDATE "swidTag" SET "swidTagRevision" = "swidTagRevision" + 1,
            "closed" = NOW() ${putFields.updates} WHERE ${keys.where} RETURNING *`;
        const result = await pgclient.sqlQuery(res, sqlCmd, keys.getAllValues());
        if (result.rows.length) {
            const snapshotBody = result.rows[0];
            await snapshot.storeSnapshot(res, snapshotBody.softwareLicensorId,
                "swidTag", res.locals.params.swTagId, snapshotBody.swidTagRevision, snapshotBody);
        }
        utils.logInfo(res, `out revokeSwidTag(${res.locals.params.swTagId})`);
    },
    /**
     * put swid-tag into database
     * @param  {} res
     */
    async putSwidTag(res) {
        if (!res.locals.params.swTagId) {
            utils.logInfo(res, `skipped putSwidTag(${res.locals.params.swTagId})`);
            return;
        }
        utils.logInfo(res, `in putSwidTag(${res.locals.params.swTagId})`);

        const swidTag = utils.getFromReqByPath(res, "swidTag");

        const keys = new SqlParams();
        keys.addField("swTagId", res.locals.params.swTagId);
        const putFields = new SqlParams(keys);
        putFields.addFieldsFromBody(swidTagReq, swidTag);
        putFields.addFieldJson("swCatalogs", swidTag.swCatalogs);

        const houseFields = new SqlParams(putFields);
        houseFields.addField("swidTagActive", true);
        houseFields.addField("modifier", res.locals.params.userId);
        houseFields.addField("closer", null);
        houseFields.addField("closed", null);
        houseFields.addField("closureReason", null);

        const insFields = new SqlParams(houseFields);
        insFields.addField("creator", res.locals.params.userId);

        const sqlCmd = `INSERT INTO "swidTag" AS swt
            (${keys.fields} ${putFields.fields} ${houseFields.fields} ${insFields.fields}, "created", "modified")
            VALUES (${keys.idxValues} ${putFields.idxValues} ${houseFields.idxValues} ${insFields.idxValues}, NOW(), NOW())
            ON CONFLICT (${keys.fields}) DO UPDATE
            SET "swidTagRevision" = swt."swidTagRevision" + 1 ${putFields.updates} ${houseFields.updates}, "modified" = NOW()
            WHERE swt."swidTagActive" = FALSE OR ${putFields.getWhereDistinct("swt")}
            RETURNING *`;
        const result = await pgclient.sqlQuery(res, sqlCmd, keys.getAllValues());

        if (result.rows.length) {
            const snapshotBody = result.rows[0];
            await snapshot.storeSnapshot(res, snapshotBody.softwareLicensorId,
                "swidTag", res.locals.params.swTagId, snapshotBody.swidTagRevision, snapshotBody);
        }
        utils.logInfo(res, `out putSwidTag(${res.locals.params.swTagId})`);
    },
    /**
     * put swid-tag creators on swid-tag in the database
     * @param  {} res
     */
    async putSwidTagCreators(res) {
        if (!res.locals.params.swTagId) {
            utils.logInfo(res, `skipped putSwidTagCreators(${res.locals.params.swTagId})`);
            return;
        }
        utils.logInfo(res, `in putSwidTagCreators(${res.locals.params.swTagId})`);

        const keys = new SqlParams();
        keys.addField("swTagId", res.locals.params.swTagId);
        const putFields = new SqlParams(keys);
        putFields.addField("swCreators", utils.getFromReqByPath(res, "swCreators"));
        const houseFields = new SqlParams(putFields);
        houseFields.addField("swidTagActive", true);
        houseFields.addField("modifier", res.locals.params.userId);
        houseFields.addField("closer", null);
        houseFields.addField("closed", null);
        houseFields.addField("closureReason", null);

        const sqlCmd = `UPDATE "swidTag" AS swt
            SET "swidTagRevision" = swt."swidTagRevision" + 1 ${putFields.updates} ${houseFields.updates}, "modified" = NOW()
            WHERE ${keys.getWhere("swt")} AND (swt."swidTagActive" = FALSE OR ${putFields.getWhereDistinct("swt")})
            RETURNING *`;
        const result = await pgclient.sqlQuery(res, sqlCmd, keys.getAllValues());
        if (result.rows.length) {
            const snapshotBody = result.rows[0];
            await snapshot.storeSnapshot(res, snapshotBody.softwareLicensorId,
                "swidTag", res.locals.params.swTagId, snapshotBody.swidTagRevision, snapshotBody);
        }
        utils.logInfo(res, `out putSwidTagCreators(${res.locals.params.swTagId})`);
    }
 };
