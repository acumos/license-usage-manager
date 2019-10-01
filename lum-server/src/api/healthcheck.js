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
const pkg = require("../../package.json");
const pgclient = require('../db/pgclient');

module.exports = {
    init() {
        lumServer.healthcheck = {
            serverName: lumServer.config.serverName || "lum-server",
            serverVersion: pkg.version,
            apiVersion: null,
            nodeVersion: process.env.NODE_VERSION,
            pgVersion: null,
            serverRunInstanceId: utils.uuid(),
            serverStarted: new Date(),
            serverUptime: "0",
            pathToOpenapiUi: "/ui/openapi"
        };
    },
    calcUptime() {
        lumServer.healthcheck.serverUptime = utils.milliSecsToString(new Date() - lumServer.healthcheck.serverStarted);
    },
    getHealthcheck(req, res, next) {
        module.exports.calcUptime();
        res.locals.response.healthcheck = lumServer.healthcheck;
        next();
    },
    async checkPg(req, res, next) {
        await pgclient.getPgVersion(res);
        next();
    }
};
