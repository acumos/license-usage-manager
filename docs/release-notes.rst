.. ===============LICENSE_START=======================================================
.. Acumos
.. ===================================================================================
.. Copyright (C) 2019 AT&T Intellectual Property. All rights reserved.
.. ===================================================================================
.. This Acumos documentation file is distributed by AT&T
.. under the Creative Commons Attribution 4.0 International License (the "License");
.. you may not use this file except in compliance with the License.
.. You may obtain a copy of the License at
..
..      http://creativecommons.org/licenses/by/4.0
..
.. This file is distributed on an "AS IS" BASIS,
.. WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
.. See the License for the specific language governing permissions and
.. limitations under the License.
.. ===============LICENSE_END=========================================================

===================================
License Usage Manager Release Notes
===================================

Version 0.25.0, 13 September 2019
---------------------------------

lum-server

- added first denials (`ACUMOS-3061 <https://jira.acumos.org/browse/ACUMOS-3061>`_)
- return http status 402 for denied assetUsage
- refactored iteration over the assetUsages
- refactored SqlParams class
- node:10.16.3-alpine
- moved eslintrc into package.json as eslintConfig
- removed assetUsageDenial table from DDL - denials are stored in assetUsageHistory
- new denialType for licenseProfileNotFound
- renamed denialType for swidTagNotFound from swTagIdNotFound
- new denialType for revoked state of swidTag, licenseProfile
- new denialType for not active state of assetUsageAgreement
- unrestricted asset-usage flow for software creators (`ACUMOS-3063 <https://jira.acumos.org/browse/ACUMOS-3063>`_)
- minor changes to API
- jsdoc - work in progress

Version 0.23.1, 11 September 2019
---------------------------------

lum-java-client

- Fixed allOfWarnings - required changes to swagger
- bumped version to 0.23.1 for all components
- Removed user from lum-db setup
- Add support for development without docker

Version 0.23.0, 09 September 2019
---------------------------------

local dev setup fixes

- Setup NodeJS server to work without docker for quicker debugging
- adding .gitignore to not include local folders / files that are only for development

first incarnation of the lum-server with basic functionality of API

- improved API definition for lum-server (`ACUMOS-3342 <https://jira.acumos.org/browse/ACUMOS-3342>`_)
- openapi-ui on lum-server (`ACUMOS-3342 <https://jira.acumos.org/browse/ACUMOS-3342>`_)
- Posgres database initdb and setup (`ACUMOS-3006 <https://jira.acumos.org/browse/ACUMOS-3006>`_)
- defined DDL for the database (`ACUMOS-3006 <https://jira.acumos.org/browse/ACUMOS-3006>`_)

first iteration of APIs on lum-server

- basic CRUD on swid-tag combined with license-profile (`ACUMOS-3035 <https://jira.acumos.org/browse/ACUMOS-3035>`_)
- basic CRUD on software-creators (`ACUMOS-3062 <https://jira.acumos.org/browse/ACUMOS-3062>`_)
- basic CRUD on asset-usage-agreement and asset-usage-agreement-restriction (`ACUMOS-3037 <https://jira.acumos.org/browse/ACUMOS-3037>`_)
- entitlement on asset-usage as for FOSS that does not require RTU (`ACUMOS-3038 <https://jira.acumos.org/browse/ACUMOS-3038>`_)
- recording the asset-usage-event (`ACUMOS-3044 <https://jira.acumos.org/browse/ACUMOS-3044>`_)
- reporting asset-usage-tracking per software-licensor-id (`ACUMOS-3230 <https://jira.acumos.org/browse/ACUMOS-3230>`_)
- reporting the healthcheck (`ACUMOS-3039 <https://jira.acumos.org/browse/ACUMOS-3039>`_)
- using alpine versions for Postgres and node.js
- eslint clean with disabled require-atomic-updates
- run eslint in docker build

What is not done yet

- asset-usage-agreement and asset-usage-agreement-restriction are just objects
- no RTUs, no matching, no usage constraints
- no relation between the asset-usage-agreement and swid-tag
- no denials - everything is entitled so far


Version 0.20.0, 29 August 2019
------------------------------

defining LUM API in lum_server-API.yaml (`ACUMOS-3342 <https://jira.acumos.org/browse/ACUMOS-3342/>`_)

- fix for tracking
- not using oneOf that breaks the java code gen
- merged softwareCreators into swid-tag as swCreators [userId]
- using http code 204 with no body for record not found.
  Header fields are returned for requestId, requested, status, params
- using http code 224 for record revoked
- req body for revoke-delete - should we use header instead ?
- healthcheck api
- removed userRole and userInfo
- asset-usage-agreement - better structure
- asset-usage-agreement-restriction - improvements
- asset-usage-event data
- having revision numbers on responses
