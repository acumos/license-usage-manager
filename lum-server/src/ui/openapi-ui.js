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

"use strict";

const router = require('express').Router();
const swaggerUi = require('swagger-ui-express');

const pathToOpenapiUi = lumServer.healthcheck.pathToOpenapiUi.replace(/(^\/|\/$)/, '');
const openapiUiSuffix = new RegExp(`${pathToOpenapiUi}/?$`);
const swaggerSet = {spec: null, opts: {}};

try {
    swaggerSet.spec = require('yamljs').load('./lum-server-api/lum-server-API.yaml');

    const ex = swaggerSet.spec.components.schemas.Healthcheck.properties.healthcheck.example;
    swaggerSet.spec.info.version = ex.serverVersion = ex.apiVersion = ex.databaseInfo.databaseVersion =
        lumServer.healthcheck.serverVersion;

    swaggerSet.opts.customSiteTitle = `${swaggerSet.spec.info.title} version ${swaggerSet.spec.info.version}`;
} catch(e) {lumServer.logger.error("ERROR: failed to load openapi-ui", e.stack);}

/**
 * set site title and server url on swagger spec based on the relative path
 * @example http://localhost/ui/openapi/#/swid-tag -> server url = /
 * @hint server record is removed when the serverPath is root /
 * @example http://localhost/lum/ui/openapi/#/swid-tag -> server url = /lum/
 * @example http://localhost/lumui/openapi/#/swid-tag -> server url = /lum
 * @param  {} req
 * @param  {} res
 * @param  {} next
 */
function setSwaggerDoc(req, res, next) {
    const swaggerURL = new URL(`${req.protocol}://${req.get('Host')}${req.originalUrl}`);
    const serverPath = swaggerURL.pathname.replace(openapiUiSuffix, '');
    if (serverPath !== swaggerURL.pathname) {
        swaggerSet.opts.customSiteTitle = `${swaggerSet.spec.info.title} version ${
            swaggerSet.spec.info.version} at ${swaggerURL.host}${serverPath.replace(/\/$/, '')}`;
        lumServer.logger.info(`openapi-ui server at(${serverPath}) from path(${
            swaggerURL.pathname}) for pathToOpenapiUi(${pathToOpenapiUi}): customSiteTitle(${
                swaggerSet.opts.customSiteTitle})`);
        if (serverPath === '/') {
            if (swaggerSet.spec.servers) {delete swaggerSet.spec.servers;}
        } else {swaggerSet.spec.servers = [{url: serverPath, description: 'path to lum-server'}];}

        req.swaggerDoc = swaggerSet.spec;
    }
    next();
}

router.use("/", setSwaggerDoc, swaggerUi.serve, swaggerUi.setup(null, swaggerSet.opts));

module.exports = router;
