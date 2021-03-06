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

const pgclient = require('./pgclient');
const SqlParams = require('./sql-params');

const DATE_FIELDS = ["enableOn", "expireOn"];

module.exports = {
    /**
     * store the copy of table record into snapshot table
     * @param  {} res
     * @param  {string} softwareLicensorId identifier of the supplier or owner of the software
     * @param  {string} snapshotType ENUM {licenseProfile, swidTag, assetUsageAgreement, rightToUse}
     * @param  {string} snapshotKey PK to the source table like swTagId
     * @param  {integer} snapshotRevision revision field on the source table like swidTagRevision
     * @param  {} snapshotBody full record from source table
     */
    async storeSnapshot(res, softwareLicensorId, snapshotType, snapshotKey, snapshotRevision, snapshotBody) {
        const logSnapshot = `storeSnapshot[${softwareLicensorId},${snapshotType},${snapshotKey},${snapshotRevision}]`;
        lumServer.logger.debug(res, `in ${logSnapshot}`);

        // convert date-time field to date string
        DATE_FIELDS.forEach(dateField => {
            const dateValue = snapshotBody[dateField];
            if (dateValue) {
                if (dateValue instanceof Date) {
                    snapshotBody[dateField] = dateValue.toISOString().substr(0, 10);
                } else if (typeof dateValue === 'string') {
                    snapshotBody[dateField] = dateValue.substr(0, 10);
                }
            }
        });

        const keys = new SqlParams();
        keys.addField("softwareLicensorId", softwareLicensorId || "");
        keys.addField("snapshotType", snapshotType);
        keys.addField("snapshotKey", snapshotKey);
        keys.addField("snapshotRevision", snapshotRevision);
        const putFields = new SqlParams(keys);
        putFields.addField("snapshotBody", snapshotBody);
        putFields.addField("creator", res.locals.params.userId);
        putFields.addField("requestId", res.locals.requestId);
        putFields.addField("txStep", (res.locals.pg.txStep || '').trim());

        const sqlCmd = `INSERT INTO "snapshot" (${keys.fields} ${putFields.fields})
                        VALUES (${keys.idxValues} ${putFields.idxValues})
                        ON CONFLICT (${keys.fields}) DO NOTHING`;
        await pgclient.sqlQuery(res, sqlCmd, keys.getAllValues());

        lumServer.logger.debug(res, `out ${logSnapshot}`);
    }
 };
