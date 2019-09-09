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

router.use('/swid-tag', require('./swid-tag').router);
router.use('/swid-tag-creators', require('./swid-tag-creators'));

router.use('/asset-usage-agreement', require('./asset-usage-agreement').router);
router.use('/asset-usage-agreement-restriction', require('./asset-usage-agreement-restriction'));

router.use('/asset-usage', require('./asset-usage').router);
router.use('/asset-usage-event', require('./asset-usage-event'));

router.use('/asset-usage-tracking', require('./asset-usage-tracking'));

module.exports = router;
