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
 * @global  lumServer - place where all global data is stored on lum-server
 */
global.lumServer = {started: new Date()};

const utils = require('./src/utils');

require('./src/config.js').loadConfig();
require('./src/logger.js').initLogger(lumServer.config.serverName);
require('./src/db/pgclient.js').initDb();

const healthcheck = require('./src/api/healthcheck');
healthcheck.init();

const lumApi = require('./src/api');

const express = require('express');
const app = express();

app.use('/ui/openapi', require('./src/ui/openapi-ui'));

app.set('x-powered-by', false);
app.set('etag', false);
app.set('json spaces', 0);
app.use(express.json({strict: true, limit: '150mb'}));

app.use('/api', lumApi);

app.get('/', lumApi);

const lumHttpServer = require('http').createServer(app);

lumHttpServer.listen(lumServer.config.port, () => {
    lumServer.logger.info(`started ${lumServer.config.serverName}:
        config(${JSON.stringify(lumServer.config, utils.hidePass)})
        env(${JSON.stringify(process.env, utils.hidePass)})`);

    healthcheck.logHealthcheck();
});
lumServer.logger.info(`starting ${lumServer.config.serverName}...`);
