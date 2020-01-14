// ================================================================================
// Copyright (c) 2020 AT&T Intellectual Property. All rights reserved.
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
 * @file class for mocking node-postgres package
 */
"use strict";

const assert = require('chai').assert;
const mockUtils = require('./mock-utils');

/**
 * tree walk the result and convert all special fields
 * "__to_date__|2019-12-19T11:43:20.952Z" -> new Date(2019-12-19T11:43:20.952Z)
 * @param  {} result
 */
function convertFields(result) {
    if (result == null) {return;}
    if (Array.isArray(result)) {
        for (const item of result) {
            convertFields(item);
        }
        return;
    }
    for (const key in result) {
        const value = result[key];
        if (typeof value === 'string' && value.startsWith('__to_date__|')) {
            result[key] = new Date(value.replace('__to_date__|', ''));
        } else if (typeof value === 'object') {
            convertFields(value);
        }
    }
}

class PgClientMock {
    /**
     * PgClientMock - client in MockPg
     */
    constructor() {
        console.log(`mock-pg - creating PgClientMock`);
        this.reset();
    }
    /**
     * release does nothing in test
     */
    release() {}
    /**
     * reset expectations on starting new test
     * @param  {[Object]} expectations objects with {sqlCmd, sqlVals, result/exception}
     */
    reset(expectations) {
        this.queryIdx     = -1;
        this.expectations = (expectations && JSON.parse(JSON.stringify(expectations))) || [];
    }
    /**
     * verify that all expected queries ran
     */
    verify() {
        assert.strictEqual(this.queryIdx + 1, this.expectations.length,
            `Not all expected[${this.expectations.length}] queries executed[${this.queryIdx + 1}]`);
    }
    /**
     * fake query to database
     * @param  {string} sqlCmd sql command
     * @param  {[Object]} sqlVals values of params to sql command
     * @returns {Promise<{command: string, rowCount: number, rows: [Object]}>} query result
     */
    async query(sqlCmd, sqlVals) {
        ++this.queryIdx;
        const logLine = `query[${this.queryIdx}]: (${sqlCmd}, ${JSON.stringify(sqlVals)})`;
        lumServer.logger.info(`mock-pg ${logLine}`);

        assert.isBelow(this.queryIdx, this.expectations.length, `No query expected: ${logLine}`);
        const expected = this.expectations[this.queryIdx];
        assert.isOk(expected, `No expected query: ${logLine}, expectations.length(${this.expectations.length})`);

        if (sqlCmd === 'ROLLBACK' && expected.sqlCmd !== 'ROLLBACK') {
            --this.queryIdx;
            lumServer.logger.info(`mock-pg ${logLine} unexpected rollback - done`);
            return;
        }

        assert.strictEqual(sqlCmd, expected.sqlCmd,
            `Unexpected query: ${logLine}, expected(${expected.sqlCmd})`);

        if (expected.sqlVals) {
            mockUtils.assertDeepEqual(sqlVals, expected.sqlVals,
                `Unexpected query params: ${logLine}, expected(${JSON.stringify(expected)})`
            );
        }

        if (expected.exception) {
            throw expected.exception;
        }
        // const result = {command: rslt.command, rowCount: rslt.rowCount, rows: rslt.rows};
        const convertedResult = JSON.parse(JSON.stringify(expected.result));
        convertFields(convertedResult);
        lumServer.logger.info(`mock-pg results:`, convertedResult);
        return convertedResult;
    }
}

module.exports = {
    /**
     * using singleton client to Postgres database
     */
    pgClientMock: new PgClientMock(),
    /**
     * mock pool of connections to Postgres database
     */
    Pool: class Pool {
        /**
         * mock Pool of connections to Postgres database
         * @param  {} pgOptions connect options to postgres database - ignored in testing
         */
        constructor(pgOptions) {
            console.log('mock-pg - creating Pool');
            this.pgOptions = pgOptions;
        }
        /**
         * mock autocommited query to database
         * @param  {string} sqlCmd sql command
         * @param  {[Object]} sqlVals values of params to sql command
         * @returns {Promise<{command: string, rowCount: number, rows: [Object]}>} query result
         */
        async query(sqlCmd, sqlVals) {
            lumServer.logger.info(`mock-pg pool.query(...)`);
            return module.exports.pgClientMock.query(sqlCmd, sqlVals);
        }
        /**
         * @returns {} pgClientMock singleton
         */
        async connect() {
            return module.exports.pgClientMock;
        }
    }
};
