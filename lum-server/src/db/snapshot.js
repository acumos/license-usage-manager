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
const SqlParams = require('./sql-params');

module.exports = {
    async addSnapshot(res, snapshotType, snapshotKey, snapshotRevision, snapshotBody) {
        utils.logInfo(res, `in addSnapshot(${snapshotType})`);

        const keys = new SqlParams();
        keys.addParam("snapshotType", snapshotType);
        keys.addParam("snapshotKey", snapshotKey);
        keys.addParam("snapshotRevision", snapshotRevision);
        const putFields = new SqlParams(keys.nextOffsetIdx);
        putFields.addParam("snapshotBody", snapshotBody);
        putFields.addParam("creator", res.locals.params.userId);

        const sqlCmd = `INSERT INTO "snapshot" (${keys.fields} ${putFields.fields})
                        VALUES (${keys.idxValues} ${putFields.idxValues})
                        ON CONFLICT (${keys.fields}) DO NOTHING`;
        await pgclient.sqlQuery(res, sqlCmd, keys.values.concat(putFields.values));

        utils.logInfo(res, `out addSnapshot(${snapshotType})`);
    }
 };
