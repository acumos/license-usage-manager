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

const utils = require('../utils');
const pgclient = require('../db/pgclient');

module.exports = {
    /**
     * initialize the healthcheck structure that is sent back to client on healthcheck requests
     */
    init() {
        lumServer.healthcheck = {
            serverName: lumServer.config.serverName,
            serverVersion: require("../../package.json").version,
            apiVersion: null,
            nodeVersion: process.env.NODE_VERSION,
            databaseInfo: null,
            serverRunInstanceId: utils.uuid(),
            serverStarted: lumServer.started,
            serverUptime: "0",
            pathToOpenapiUi: "/ui/openapi"
        };
    },
    /**
     * calculate the uptime of the lum-server and store it into lumServer.healthcheck.serverUptime
     */
    calcUptime() {
        lumServer.healthcheck.serverUptime = utils.milliSecsToString(utils.now());
    },
    /**
     * put healthcheck into response
     * @param  {} req
     * @param  {} res
     * @param  {} next
     */
    async getHealthcheck(req, res, next) {
        await module.exports.checkPg(res);
        module.exports.calcUptime();
        res.locals.response.healthcheck = utils.deepCopyTo({}, lumServer.healthcheck);
        next();
    },
    /**
     * check connection to postgres by getting the postgres version
     * @param  {} res
     */
    async checkPg(res) {
        try {
            await pgclient.getLumDbInfo(res, true);
        } catch (error) {
            lumServer.logger.error(res, "ERROR checkPg", error.code, error.stack);
            lumServer.healthcheck.databaseInfo = null;
        }
    },
    /**
     * run healthcheck on its own in async mode from sync environment
     */
    logHealthcheck() {
        (async () => {
            await module.exports.checkPg();
            module.exports.calcUptime();
            lumServer.logger.info('healthcheck', lumServer.healthcheck);
        })();
    }
};
