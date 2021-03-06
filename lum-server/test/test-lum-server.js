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
 * @global lumServer
 */
global.lumServer = {};

const fs = require('fs')
    , path = require('path')
    , readline = require('readline')
    , chai = require('chai')
    , chaiHttp = require('chai-http')
    , mockRequire = require('mock-require')
    , expect = chai.expect;

const utils  = require('../src/utils')
    , mockPg = require('./mock-pg')
    , mockUtils = require('./mock-utils');

chai.use(chaiHttp);

const acuLogPath = './log-acu/lum-server/lum-server.log';

/**
 * generate integer steps
 * @param  {number} maxCount
 */
async function* asyncCountGenerator(maxCount = 5) {
    for (var i = 0; i < maxCount; ++i) {yield i;}
}

/**
 * remove the log file from fs
 * @param  {string} path to the file
 */
function removeFile(path) {
    if (fs.existsSync(path)) {fs.unlinkSync(path);}
}
/**
 * reads json file from fs
 * @param  {string} path to the file
 * @returns {} parsed content of the json file
 */
function readJson(path) {
    if (fs.existsSync(path)) {return JSON.parse(fs.readFileSync(path, 'utf8'));}
}

/**
 * read json lines from the acumos log file and filter by requestId
 * @param  {string} requestId filter record by RequestID
 * @returns {[]} array of parsed lines
 */
async function readAcuLog(requestId) {
    await utils.sleep(10);
    const rl = readline.createInterface({input: fs.createReadStream(acuLogPath), crlfDelay: Infinity});
    const lines = [];
    for await (const line of rl) {
        const logEntry = JSON.parse(line);
        if (logEntry.RequestID === requestId) {
            lines.push(logEntry);
        }
    }
    return lines;
}


before(function() {
    process.env.NODE_VERSION = process.env.NODE_VERSION || 'test-version';
    process.env.LOG_CONSOLE_OFF = "yes";
    process.env.LOGDIR = "logs";

    console.log(`${utils.milliSecsToString(utils.now())}: before all testing ${process.env.NODE_VERSION} ${(new Date()).toISOString()}`);

    removeFile(acuLogPath);
    removeFile('./logs/dev_lum-server.log');
    removeFile('./logs/healthcheck_lum-server.log');
    mockRequire('pg', './mock-pg');
});

after(function() {
    console.log(`${utils.milliSecsToString(utils.now())}: done all testing ${(new Date()).toISOString()}`);
    mockRequire.stop('pg');
});

describe('lum-server', function () {
    this.timeout(10000);
    before(async function() {
        this.timeout(0);
        console.log(`${utils.milliSecsToString(utils.now())}: before testing lum-server`);

        console.log(`${utils.milliSecsToString(utils.now())}: readJson('./expectations/00_healthcheck.json')`);
        const healthcheck = readJson(path.join('./test/expectations','00_healthcheck.json')) || {};
        mockPg.pgClientMock.reset(healthcheck.db);

        console.log(`${utils.milliSecsToString(utils.now())}: require('../lum-server.js')`);
        require('../lum-server.js');

        for await (const waitStep of asyncCountGenerator(10)) {
            if (lumServer.healthcheck.databaseInfo) {
                console.log(`${utils.milliSecsToString(utils.now())}: lumServer ready[${waitStep}]: ${lumServer.config.serverName}`);
                lumServer.logger.info(`lumServer ready[${waitStep}]: ${lumServer.config.serverName}`);
                break;
            }
            console.log(`${utils.milliSecsToString(utils.now())}: lumServer waiting[${waitStep}] for init: ${lumServer.config.serverName}`);
            lumServer.logger.info(`lumServer waiting[${waitStep}] for init: ${lumServer.config.serverName}`);
            await utils.sleep(10);
        }
        mockPg.pgClientMock.verify();
        chai.assert.isOk(lumServer.healthcheck.databaseInfo, `lumServer failed to init: ${lumServer.config.serverName}`);

        console.log(`${utils.milliSecsToString(utils.now())}: lumServer inited: ${lumServer.config.serverName}`, lumServer.healthcheck);
        lumServer.logger.info(`lumServer inited: ${lumServer.config.serverName}`, lumServer.healthcheck);
        console.log('-'.repeat(50));
        const logger = require('../src/logger');
        logger.setLogging(null, {logLevel: "debug"});
    });

    afterEach(async function() {
        lumServer.logger.info(`waiting for logs to flush...`);
        await utils.sleep(10);
    });

    const expectationFiles = fs.readdirSync('./test/expectations');
    console.log(`${utils.milliSecsToString(utils.now())}: lumServer testing: ${JSON.stringify(expectationFiles)}`);
    expectationFiles.forEach(function(expectationFile, index) {
        const expectation = readJson(path.join('./test/expectations', expectationFile));
        const requestId = expectation.req["X-ACUMOS-RequestID"] || utils.uuid();
        const testLog = `api[${index.toString().padStart(2,'0')}]: ${expectationFile} ${expectation.req.method} ${expectation.res.statusCode} (${requestId})`;
        it(testLog, async function() {
            console.log(`    -> ${utils.milliSecsToString(utils.now())}: ${testLog}`);
            lumServer.logger.info(`---->> start ${testLog}`);
            chai.assert.isOk(expectation, `unexpected expectation: ${JSON.stringify(expectation)}`);
            mockPg.pgClientMock.reset(expectation.db);

            chai.assert.isOk(expectation.req, `unexpected expectation.req: ${JSON.stringify(expectation.req)}`);
            chai.assert.oneOf(expectation.req.method, ["GET", "PUT", "DELETE"], `unexpected expectation.req.method: ${expectation.req.method}`);
            chai.assert.isString(expectation.req.path, `unexpected expectation.req.path: ${expectation.req.path}`);

            let testReq = chai.request(lumServer.app);
            if (expectation.req.method === "GET")           {testReq = testReq.get(expectation.req.path);
            } else if (expectation.req.method === "PUT")    {testReq = testReq.put(expectation.req.path);
            } else if (expectation.req.method === "DELETE") {testReq = testReq.delete(expectation.req.path);}
            if (expectation.req.send)                       {testReq = testReq.send(expectation.req.send);}
            if (expectation.req["content-type"])            {testReq = testReq.set("content-type", expectation.req["content-type"]);}
            testReq.set("X-ACUMOS-RequestID", requestId);

            const res = await testReq;
            lumServer.logger.info(`<<---- res ${res.statusCode} for ${testLog}:`, res.text);
            expect(res).to.be.json;
            if (res.statusCode === 500 && res.body && res.body.error
                && expectation.res.statusCode !== res.statusCode) {
                lumServer.logger.error(`ERROR res ${res.statusCode} for ${testLog}:`, res.body.error);
                throw res.body.error;
            }

            expect(res).to.have.status(expectation.res.statusCode);
            mockPg.pgClientMock.verify();

            if (expectation.res.bodySubsetKeys) {
                const bodySubset = {};
                const notFound = [];
                for (const expectedRec of expectation.res.bodySubsetKeys) {
                    if (!bodySubset[expectedRec.field]) {bodySubset[expectedRec.field] = [];}
                    const subsetData = res.body[expectedRec.field];
                    chai.assert.isArray(subsetData, `unexpected value(${JSON.stringify(subsetData)}) for ${JSON.stringify(expectedRec)}`);
                    const found = subsetData.some(subsetItem => {
                        if (subsetItem[expectedRec.key] === expectedRec.value) {
                            bodySubset[expectedRec.field].push(subsetItem);
                            return true;
                        }
                    });
                    if (!found) {notFound.push(subsetRec);}
                }
                chai.assert.isEmpty(notFound, `expected ${JSON.stringify(notFound)} in ${JSON.stringify(res.body)}`);
                mockUtils.assertDeepEqual(bodySubset, expectation.res.bodySubset, `unexpected bodySubset (${bodySubset}) for ${JSON.stringify(expectation.res.bodySubset)}`);
            }

            mockUtils.assertDeepEqual(res.body, expectation.res.body, `unexpected res for ${testLog}`);
            if (expectation.acuLogs) {
                lumServer.logger.info(`<<---- expecting ${expectation.acuLogs.length} acuLogs for ${requestId}`);
                const acuLogs = await readAcuLog(requestId);
                lumServer.logger.info(`<<---- got ${acuLogs.length} acuLogs:`, acuLogs);
                mockUtils.assertDeepEqual(acuLogs, expectation.acuLogs, `unexpected acuLogs for ${testLog}`);
            }
            lumServer.logger.info(`<<---- done`);
        });
    });
}).timeout(10000);