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
 * @global  lumServer - place where all global data is stored on lum-server
 */
global.lumServer = {started: new Date()};

const utils = require('./src/utils');

require('./src/config.js').loadConfig();
require('./src/logger.js').initLogger();
require('./src/db/pgclient.js').initDb();

const healthcheck = require('./src/api/healthcheck');
healthcheck.init();

const lumApi = require('./src/api');

const express = require('express');
lumServer.app = express();

lumServer.app.use('/ui/openapi', require('./src/ui/openapi-ui'));

lumServer.app.set('x-powered-by', false);
lumServer.app.set('etag', false);
lumServer.app.set('json spaces', 0);
lumServer.app.use(express.json({strict: true, limit: '150mb'}));

lumServer.app.use('/api', lumApi);

lumServer.app.get('/', lumApi);

lumServer.app.use('/admin', require('./src/admin'));

const lumHttpServer = require('http').createServer(lumServer.app);

lumHttpServer.listen(lumServer.config.port, () => {
    lumServer.logger.info(`started ${lumServer.config.serverName}:
        config(${JSON.stringify(lumServer.config, utils.hidePass)})
        env(${JSON.stringify(process.env, utils.hidePass)})`);

    healthcheck.logHealthcheck();
});
lumServer.logger.info(`starting ${lumServer.config.serverName}...`);
