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
/**
 * @file all communication with the postgres database goes through this module
 */

"use strict";

const pg = require('pg');
const utils = require('../utils');
const {InvalidDataError} = require('../error');

const pgTx = {
    begin: 'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ',
    commit: 'COMMIT',
    rollback: 'ROLLBACK',
    release: 'pg.client.release'
};

/**
 *  log the step info
 * @param  {} res
 * @param  {} runStep
 */
function logRunStepInfo(res, runStep) {
    if (!res.locals.pg) {res.locals.pg = {};}
    if (runStep) {
        if ([pgTx.rollback, pgTx.release].includes(runStep)) {
            res.locals.pg.runStep = `${runStep} <- ${res.locals.pg.runStep}`;
        } else {res.locals.pg.runStep = utils.makeOneLine(runStep);}
    }
    utils.logInfo(res, utils.getPgStepInfo(res));
}
/**
 * connect to database through the pool
 * @param  {} res
 */
async function connect(res) {
    if (!res.locals.pg.client) {
        logRunStepInfo(res, "pg.pool.connect");
        res.locals.pg.client = await lumServer.pgPool.connect();
        if (res.locals.pg.txid)         {delete res.locals.pg.txid;}
        if (res.locals.pg.txNow)        {delete res.locals.pg.txNow;}
        if (res.locals.pg.txNowDate)    {delete res.locals.pg.txNowDate;}
        if (res.locals.pg.txStep)       {delete res.locals.pg.txStep;}
    }
}
/**
 * release the client to database back to the pool
 * @param  {} res
 */
function release(res) {
    if (res.locals.pg.client) {
        logRunStepInfo(res, pgTx.release);
        res.locals.pg.client.release();
        delete res.locals.pg.client;
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
            "SELECT TXID_CURRENT() AS txid, PG_BACKEND_PID() AS pid, NOW() AS tx_now");
        if (rows.length) {
            res.locals.pg.txid  = ` txid(${rows[0].txid}) pid(${rows[0].pid})`;
            res.locals.pg.txNow = rows[0].tx_now;
            res.locals.pg.txNowDate = res.locals.pg.txNow.toISOString().substr(0,10);
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
        const pgOptions = utils.deepCopyTo({}, lumServer.config.database);
        lumServer.logger.info(`initializing pgclient(${JSON.stringify(pgOptions, utils.hidePass)})...`);
        lumServer.pgPool = new pg.Pool(pgOptions);
    },
    /**
     * retrieve the version info from the database
     * @param  {} res
     * @param  {boolean} always when true - get fresh data
     */
    async getLumDbInfo(res, always=false) {
        if (always || !lumServer.healthcheck.databaseInfo) {
            utils.logInfo(res, "in getLumDbInfo", lumServer.healthcheck.databaseInfo || '');
            const {rows} = await lumServer.pgPool.query(utils.makeOneLine(
                `SELECT VERSION() AS "pgVersion", "lumVersion" AS "databaseVersion",
                    "created" AS "schemaCreated", "modified" AS "schemaModified",
                    PG_POSTMASTER_START_TIME() AS "databaseStarted",
                    (NOW() - PG_POSTMASTER_START_TIME())::TEXT AS "databaseUptime", NOW() AS "checked"
                   FROM "lumInfo" WHERE "lumSystem" = 'LUM'`));
            if (rows.length) {
                lumServer.healthcheck.databaseInfo = rows[0];
                utils.logInfo(res, "out getLumDbInfo", lumServer.healthcheck.databaseInfo);
            }
        }
    },
    /**
     * run single query that is part of the bigger transaction
     * @param  {} res
     * @param  {} sqlCmd SQL command with params
     * @param  {} sqlVals values for params used in SQL command
     */
    async sqlQuery(res, sqlCmd, sqlVals) {
        sqlCmd = utils.makeOneLine(sqlCmd);
        logRunStepInfo(res, `sqlQuery (${sqlCmd}) with (${JSON.stringify(sqlVals)})`);
        const rslt = await res.locals.pg.client.query(sqlCmd, sqlVals);
        const result = {command: rslt.command, rowCount: rslt.rowCount, rows: rslt.rows};
        if (sqlCmd.length > 100) {sqlCmd = `${sqlCmd.substr(0,100)}...`;}
        logRunStepInfo(res, `sqlQuery result: (${JSON.stringify(result)}) for (${sqlCmd}) with (${JSON.stringify(sqlVals)})`);
        delete res.locals.pg.runStep;
        return result;
    },
    /**
     * run a single standalone query in auto-commit mode
     * @param  {} res
     * @param  {} sqlCmd SQL command with params
     * @param  {} sqlVals values for params used in SQL command
     */
    async standaloneQuery(res, sqlCmd, sqlVals) {
        sqlCmd = utils.makeOneLine(sqlCmd);
        logRunStepInfo(res, `standaloneQuery (${sqlCmd}) with (${JSON.stringify(sqlVals)})`);
        const rslt = await lumServer.pgPool.query(sqlCmd, sqlVals);
        const result = {command: rslt.command, rowCount: rslt.rowCount, rows: rslt.rows};
        logRunStepInfo(res, `standaloneQuery result (${JSON.stringify(result)}) for (${sqlCmd}) with (${JSON.stringify(sqlVals)})`);
        if (res.locals.pg.runStep) {delete res.locals.pg.runStep;}
        return result;
    },
    /**
     * run transaction of multiple steps-queries with retries
     * @param  {} res
     * @param  {...function} txSteps
     */
    async runTx(res, ...txSteps) {
        logRunStepInfo(res, `runTx txSteps[${txSteps.length}]`);
        if (txSteps.length) {
            const responseBackup = JSON.stringify(res.locals.response);
            for (res.locals.pg.txRetryCount = 1; res.locals.pg.txRetryCount <= lumServer.config.maxTxRetryCount; ++res.locals.pg.txRetryCount) {
                try {
                    let iStep = 0;
                    let iStepTxt = iStep.toString().padStart(2,'0');
                    res.locals.pg.txStep = ` [${iStepTxt}] getLumDbInfo`;
                    await module.exports.getLumDbInfo(res);
                    res.locals.pg.txStep = ` [${iStepTxt}] connect`;
                    await connect(res);
                    res.locals.pg.txStep = ` [${iStepTxt}] begin`;
                    await begin(res);
                    for await (const txStep of txSteps) {
                        iStepTxt = (++iStep).toString().padStart(2,'0');
                        if (typeof txStep === 'function') {
                            res.locals.pg.txStep = ` [${iStepTxt}] ${txStep.name}`;
                            logRunStepInfo(res, `runTx step[${iStepTxt}]`);
                            await txStep(res);
                            delete res.locals.pg.txStep;
                        } else {
                            logRunStepInfo(res, `[${iStepTxt}] - runTx step skipped: non-function(${typeof txStep})`);
                        }
                    }
                    iStepTxt = (++iStep).toString().padStart(2,'0');
                    res.locals.pg.txStep = ` [${iStepTxt}] commit`;
                    await commit(res);
                    res.locals.pg.txStep = ` [${iStepTxt}] release`;
                    release(res);
                    break;
                } catch (error) {
                    utils.logError(res, utils.getPgStepInfo(res), "ERROR runTx", error.code, error.stack);
                    await rollback(res);
                    release(res);
                    if (error instanceof InvalidDataError) {
                        throw error;
                    }
                    if (error.code === "ECONNREFUSED" && res.locals.pg.txRetryCount < lumServer.config.maxTxRetryCount) {
                        lumServer.healthcheck.databaseInfo = null;
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
                    res.locals.response = JSON.parse(responseBackup);
                    logRunStepInfo(res, `runTx txSteps[${txSteps.length}] - going to retry(<=${lumServer.config.maxTxRetryCount})`);
                }
            }
        }
    }
};
