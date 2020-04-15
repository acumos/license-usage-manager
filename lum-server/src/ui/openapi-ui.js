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

try {
    const swaggerSpec = require('yamljs').load('./lum-server-api/lum-server-API.yaml');

    const version = require('../../package.json').version;
    const ex = swaggerSpec.components.schemas.Healthcheck.properties.healthcheck.example;
    swaggerSpec.info.version = version;
    ex.serverVersion = version;
    ex.apiVersion = version;
    ex.databaseInfo.databaseVersion = version;
    lumServer.healthcheck.apiVersion = version;

    router.use("/", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
} catch(e) {lumServer.logger.error("ERROR: failed to load openapi-ui", e.stack);}

module.exports = router;
