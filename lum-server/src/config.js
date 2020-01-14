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

module.exports = {
    /**
     * load config for lum-server from etc/config.json
     * and store it in the global lumServer.config
     */
    loadConfig() {
        lumServer.config = require('../etc/config.json').lumServer || {};
        lumServer.config.port              = process.env.APPPORT || lumServer.config.port || 2080;
        lumServer.config.serverName        = lumServer.config.serverName || "lum-server";
        lumServer.config.maxTxRetryCount   = lumServer.config.maxTxRetryCount || 10;
        lumServer.config.database          = lumServer.config.database || {};
        lumServer.config.database.password = process.env.DATABASE_PASSWORD || lumServer.config.database.password;
        lumServer.config.loggerLevel       = process.env.LOGGER_LEVEL || 'info';
    }
};
