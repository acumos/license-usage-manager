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

const Router = require('express-promise-router');
const router = new Router();

const response = require('./response.js');

router.use(response.newReq);

router.use('/v1', require('./v1'));

router.get(['/healthcheck', '/'], require('./healthcheck').getHealthcheck);

router.use(response.respond);
router.use(response.responseError);

module.exports = router;
