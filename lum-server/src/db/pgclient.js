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
 * @file all communication with the postgres database goes through this module
 */

"use strict";

const pg = require('pg');
const utils = require('../utils');

const pgTx = {
    begin: 'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ',
    commit: 'COMMIT',
    rollback: 'ROLLBACK',
};

var pgPool;

/**
 *  log the step info
 * @param  {} res
 * @param  {} runStep
 */
function logRunStepInfo(res, runStep) {
    if (!res.locals.pg) {res.locals.pg = {};}
    if (runStep) {res.locals.pg.runStep = runStep;}
    utils.logInfo(res, utils.getPgStepInfo(res));
}
/**
 * connect to database through the pool
 * @param  {} res
 */
async function connect(res) {
    if (!res.locals.pg.client) {
        logRunStepInfo(res, "pg.pool.connect");
        const client = await pgPool.connect();
        res.locals.pg.client = client;
    }
}
/**
 * release the client to database back to the pool
 * @param  {} res
 */
function release(res) {
    if (res.locals.pg.client) {
        logRunStepInfo(res, "pg.client.release");
        res.locals.pg.client.release();
        res.locals.pg.txRetryCount = 0;
        delete res.locals.pg.client;
        if (res.locals.pg.txid)     {delete res.locals.pg.txid;}
        if (res.locals.pg.txNow)    {delete res.locals.pg.txNow;}
        if (res.locals.pg.txStep)   {delete res.locals.pg.txStep;}
        if (res.locals.pg.runStep)  {delete res.locals.pg.runStep;}
    }
}
/**
 * begin the transaction in database
 * @param  {} res
 */
async function begin(res) {
    if (res.locals.pg.client) {
        logRunStepInfo(res, pgTx.begin);
        await res.locals.pg.client.query(pgTx.begin);
        res.locals.pg.inTx = true;

        const {rows} = await res.locals.pg.client.query(
            "SELECT txid_current() AS txid, pg_backend_pid() AS pid, NOW() AS tx_now");
        if (rows.length) {
            res.locals.pg.txid  = ` txid(${rows[0].txid}) pid(${rows[0].pid})`;
            res.locals.pg.txNow = rows[0].tx_now;
        }
        logRunStepInfo(res, `NOW(${res.locals.pg.txNow.toISOString()})`);
    }
}
/**
 * rollback the transaction in database
 * @param  {} res
 */
async function rollback(res) {
    if (res.locals.pg.client && res.locals.pg.inTx) {
        logRunStepInfo(res, pgTx.rollback);
        await res.locals.pg.client.query(pgTx.rollback);
        res.locals.pg.inTx = false;
    }
}
/**
 * commit the transaction in database
 * @param  {} res
 */
async function commit(res) {
    if (res.locals.pg.client && res.locals.pg.inTx) {
        logRunStepInfo(res, pgTx.commit);
        await res.locals.pg.client.query(pgTx.commit);
        res.locals.pg.inTx = false;
    }
}

module.exports = {
    /**
     * create the pool of connections to the database
     */
    initDb() {
        const pgOptions = Object.assign({}, lumServer.config.database);
        lumServer.logger.info(`initializing pgclient(${JSON.stringify(pgOptions, utils.hidePass)})...`);
        pgPool = new pg.Pool(pgOptions);
    },
    /**
     * retrieve the version info from the database
     * @param  {} res
     */
    async getPgVersion(res) {
        if (!lumServer.healthcheck.pgVersion) {
            logRunStepInfo(res, "getPgVersion");
            const {rows} = await pgPool.query("SELECT version() AS pg_version");
            if (rows.length) {
                lumServer.healthcheck.pgVersion = rows[0].pg_version;
                logRunStepInfo(res, `pgVersion=${lumServer.healthcheck.pgVersion}`);
            }
        }
    },
    /**
     * run single query that is part of the bigger transaction
     * @param  {} res
     * @param  {} sqlCmd
     * @param  {} sqlVals
     */
    async sqlQuery(res, sqlCmd, sqlVals) {
        logRunStepInfo(res, `sqlQuery (${sqlCmd}) with (${JSON.stringify(sqlVals)})`);
        const rslt = await res.locals.pg.client.query(sqlCmd, sqlVals);
        const result = {command: rslt.command, rowCount: rslt.rowCount, rows: rslt.rows};
        logRunStepInfo(res, `sqlQuery result: (${JSON.stringify(result)}) for (${sqlCmd}) with (${JSON.stringify(sqlVals)})`);
        delete res.locals.pg.runStep;
        return result;
    },
    /**
     * run a single standalone query in auto-commit mode
     * @param  {} res
     * @param  {} sqlCmd
     * @param  {} sqlVals
     */
    async standaloneQuery(res, sqlCmd, sqlVals) {
        logRunStepInfo(res, `standaloneQuery (${sqlCmd}) with (${JSON.stringify(sqlVals)})`);
        const rslt = await pgPool.query(sqlCmd, sqlVals);
        const result = {command: rslt.command, rowCount: rslt.rowCount, rows: rslt.rows};
        logRunStepInfo(res, `standaloneQuery result (${JSON.stringify(result)}) for (${sqlCmd}) with (${JSON.stringify(sqlVals)})`);
        delete res.locals.pg.runStep;
        return result;
    },
    /**
     * run transaction of multiple steps-queries with retries
     * @param  {} res
     * @param  {} ...txSteps
     */
    async runTx(res, ...txSteps) {
        logRunStepInfo(res, `runTx txSteps[${txSteps.length}]`);
        if (txSteps.length) {
            const responseBackup = Object.assign({}, res.locals.response);
            for (res.locals.pg.txRetryCount = 1; res.locals.pg.txRetryCount <= lumServer.config.maxTxRetryCount; ++res.locals.pg.txRetryCount) {
                try {
                    var iStep = 0;
                    res.locals.pg.txStep = ` [${iStep}] getPgVersion`;
                    await module.exports.getPgVersion(res);
                    res.locals.pg.txStep = ` [${iStep}] connect`;
                    await connect(res);
                    res.locals.pg.txStep = ` [${iStep}] begin`;
                    await begin(res);
                    for await (const txStep of txSteps) {
                        if (typeof txStep === 'function') {
                            res.locals.pg.txStep = ` [${++iStep}]${txStep.name}`;
                            logRunStepInfo(res, `runTx step[${iStep}]`);
                            await txStep(res);
                            delete res.locals.pg.txStep;
                        } else {
                            logRunStepInfo(res, `skipped non-function(${typeof txStep}) runTx step[${++iStep}]`);
                        }
                    }
                    res.locals.pg.txStep = ` [${iStep}] commit`;
                    await commit(res);
                    res.locals.pg.txStep = ` [${iStep}] release`;
                    release(res);
                    break;
                } catch (error) {
                    utils.logError(res, utils.getPgStepInfo(res), "ERROR runTx", error.code, error.stack);
                    await rollback(res);
                    release(res);
                    if (error.code === "ECONNREFUSED" && res.locals.pg.txRetryCount < lumServer.config.maxTxRetryCount) {
                        lumServer.healthcheck.pgVersion = null;
                        await utils.sleep(500);
                    } else if (!['40P01', '40001'].includes(error.code)) {
                        throw error;
                    }
                    // aborted by postgres due to other transaction overstepping - retry again
                    // '40P01' = deadlock_detected
                    // '40001' = serialization_failure - could not serialize access due to concurrent update
                    if (res.locals.pg.txRetryCount >= lumServer.config.maxTxRetryCount) {
                        logRunStepInfo(res, `runTx txSteps[${txSteps.length}] - gave up trying(<=${lumServer.config.maxTxRetryCount})`);
                        throw error;
                    }
                    res.locals.response = Object.assign({}, responseBackup);
                    logRunStepInfo(res, `runTx txSteps[${txSteps.length}] - going to retry(<=${lumServer.config.maxTxRetryCount})`);
                }
            }
        }
    }
};
