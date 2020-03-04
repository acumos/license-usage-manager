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
    , chai = require('chai')
    , chaiHttp = require('chai-http')
    , mockRequire = require('mock-require')
    , expect = chai.expect;

const utils  = require('../src/utils')
    , mockPg = require('./mock-pg')
    , mockUtils = require('./mock-utils');

chai.use(chaiHttp);

/**
 * generate integer steps
 * @param  {number} maxCount
 */
async function* asyncCountGenerator(maxCount = 5) {
    for (var i = 0; i < maxCount; ++i) {yield i;}
}

before(function() {
    process.env.NODE_VERSION = process.env.NODE_VERSION || 'test-version';
    process.env.COUT_LEVEL = "error";
    process.env.LOGDIR = "logs";

    console.log(`${utils.milliSecsToString(utils.now())}: before all testing ${process.env.NODE_VERSION} ${(new Date()).toISOString()}`);
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

        console.log(`${utils.milliSecsToString(utils.now())}: require('./expectations/00_healthcheck.json')`);
        const healthcheck = require('./expectations/00_healthcheck.json') || {};
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
    });

    const expectationFiles = fs.readdirSync('./test/expectations');
    console.log(`${utils.milliSecsToString(utils.now())}: lumServer testing: ${JSON.stringify(expectationFiles)}`);
    expectationFiles.forEach(function(expectationFile, index) {
        const expectation = require(`./expectations/${expectationFile}`);
        const testLog = `api[${index.toString().padStart(2,'0')}]: ${expectationFile} ${expectation.req.method} ${expectation.res.statusCode}`;
        it(testLog, function() {
            console.log(`    -> ${utils.milliSecsToString(utils.now())}: ${testLog}`);
            lumServer.logger.info(`---->> start ${testLog}`);
            chai.assert.isOk(expectation, `unexpected expectation: ${JSON.stringify(expectation)}`);
            mockPg.pgClientMock.reset(expectation.db);

            chai.assert.isOk(expectation.req, `unexpected expectation.req: ${JSON.stringify(expectation.req)}`);
            chai.assert.oneOf(expectation.req.method, ["GET", "PUT", "DELETE"], `unexpected expectation.req.method: ${expectation.req.method}`);
            chai.assert.isString(expectation.req.path, `unexpected expectation.req.path: ${expectation.req.path}`);

            var testReq = chai.request(lumServer.app);
            if (expectation.req.method === "GET")           {testReq = testReq.get(expectation.req.path);
            } else if (expectation.req.method === "PUT")    {testReq = testReq.put(expectation.req.path);
            } else if (expectation.req.method === "DELETE") {testReq = testReq.delete(expectation.req.path);}
            if (expectation.req.send)                       {testReq = testReq.send(expectation.req.send);}
            if (expectation.req["content-type"])            {testReq = testReq.set("content-type", expectation.req["content-type"]);}

            return testReq
                .then(function(res) {
                    lumServer.logger.info(`<<---- res ${res.statusCode} for ${testLog}:`, res.text);
                    expect(res).to.be.json;
                    if (res.statusCode === 500 && res.body && res.body.error
                        && expectation.res.statusCode !== res.statusCode) {
                        lumServer.logger.error(`ERROR res ${res.statusCode} for ${testLog}:`, res.body.error);
                        throw res.body.error;
                    }

                    expect(res).to.have.status(expectation.res.statusCode);
                    mockPg.pgClientMock.verify();

                    mockUtils.assertDeepEqual(res.body, expectation.res.body, `Unexpected res for ${testLog}`);
                });
        });
    });
}).timeout(10000);