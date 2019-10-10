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

Version 0.27.0, 10 October 2019
---------------------------------

lum-server
..........

- API change - params are now passed in query instead of through path -- per discussion in 0.26.4
- added ``softwareLicensorId`` as param in query on ``/api/v1/asset-usage-agreement``
  and ``/api/v1/asset-usage-agreement-restriction``
- applying ODRL agreement-restriction provided by the subscriber company
  over ODRL agreement from supplier-licensor company (`ACUMOS-3222 <https://jira.acumos.org/browse/ACUMOS-3222>`_)
- agreement APIs now return groomedAgreement for debugging
- ``healthcheck``: added ``databaseInfo`` with databaseVersion (to compare versus LUM server version)
  and databaseStarted+databaseUptime.  Moved pgVersion under databaseInfo.
- fixed false positive reporting of denials on swCatalogId/Type mismatch even when
  there is an intersection between swidTag and rightToUse target (`ACUMOS-3506 <https://jira.acumos.org/browse/ACUMOS-3506>`_)
- fixed-added populating the rightToUse and metrics data on assetUsageHistory table
- using ``operator`` from constrain to evaluate the constraint instead of deducting the ``operator`` from ``leftOperand``.
  Not fully flexible, but covers all use cases for Clio (`ACUMOS-3507 <https://jira.acumos.org/browse/ACUMOS-3507>`_)
- jsdoc


Version 0.26.5, 9 October 2019
------------------------------
* Open api changes to support fixes in LUM Java client - fixed typing of ``AssetUsageResponse`` and ``AssetUsageDenialAssetUsageDenial`` --
  Java code gen has a problem with the same property referenced by multiple schemas .. treats it as object
* ``Object getAssetUsage() -> AssetUsageDenialOrEntitlement getAssetUsage()``
* ``List<Object> getAssetUsageDenial() ->  List<AssetUsageDenialAssetUsageDenial> getAssetUsageDenial()``
* Removed wrapper schema for assetUsageDenial  ``#/components/schemas/AssetUsageDenials``
* Removed wrapper schemas for assetUsage property - for AssetUsageResponse schema

  ``- $ref: '#/components/schemas/AssetUsageResponseBase'``

  ``- $ref: '#/components/schemas/AssetUsageMixedResponse'``

  ``- $ref: '#/components/schemas/IncludedAssetUsageMixedResponse'``

  Fix caused some overlap between AssetUsageResponseBase and AssetUsageMixedResponse.


Version 0.26.4, 7 October 2019
------------------------------

- LUM integration support (`ACUMOS-3534 <https://jira.acumos.org/browse/ACUMOS-3534>`_)
  - Added new helm chart for lum + postgresql
  - New environment variable DATABASE_PASSWORD to help seperate config from secret config
  - Updated docker-compose - to handle debugging and skipping over production build steps
  - Support integration with AIO / K8 / Helm chart behind nginx proxy
    - Fixed issue with nginx-proxy decoding url causing issues with encoded url as path params
      changed   /api/v1/asset-usage-agreement/[encodedIRI] -
        ->/api/v1/asset-usage-agreement/?assetUsageAgreementId=[encodedIRI]
    - Added support for handling query param vs path param for assetUsageAgreementId
    - Added server back into lum-server-API.yaml to help with serving from different
      base path after adding nginx proxy
  - Fixed docker-compose debugging and reloading after adding multi-stage build
  - Added support for base url to be under /lum/ and support servers dropdown in swagger ui
  - Bug in swagger lint - disabled rule server-trailing-slash -- caused error for server /


Version 0.26.3, 1 October 2019
------------------------------

- Added support for nodemon support for faster reloads in docker container
- adding examples to make dredd apiary happy easier to test
- docker build change to use multi stage builds
- Include open api spec lint to docker build
- Clean up API for open api lint errors
- Update eslint
- Reserved variable name - package changed to pkg
- Adding .dockerignore to ensure node_modules are installed in docker not locally


Version 0.26.2, 30 September 2019
---------------------------------

lum-server
..........

- bringing ODRL (`ACUMOS-3219 <https://jira.acumos.org/browse/ACUMOS-3219>`_)
  (`ACUMOS-3060 <https://jira.acumos.org/browse/ACUMOS-3060>`_)
- added openAPI spec for ODRL agreement, permission, prohibition, refinement on target,
  assignee and constraints
- added a few examples to openAPI spec
- support for the ODRL variety of structures on the rightOperand and action
- the new concept of grooming the agreement and merging the constraints
  keyed by leftOperand on the load of agreement instead of storing all
  the constraints and applying all of them at the matching and usage
  constraint evaluation steps
- LUM-server now finds the rightToUse under agreement for the swidTag
  on the asset-usage, returns either the entitlement with keys of the assetUsageDenial
  with the details of denial (`ACUMOS-3040 <https://jira.acumos.org/browse/ACUMOS-3040>`_)
  (`ACUMOS-3042 <https://jira.acumos.org/browse/ACUMOS-3042>`_)
- LUM is using the "use" action that is equivalent to any action
  as soon as we bring prohibition to agreement.  LUM does not need to know all the
  possible action values. The count constraint for action: "use" will be the total count
  for any action value, rather than separate count per each action value.
  LUM will apply either the constraint on specific action, or the constraint on "use"
  when the specific action not found.
- LUM always resolves the conflict between prohibition and permission in favor of prohibition.
  That is not be controlled by the ODRL conflict clause.  No need for RTU editor to convert
  the prohibition into permission with count = 0 constraint.
- new and changed values for denialType: swidTagNotFound, swidTagRevoked,
     licenseProfileNotFound, licenseProfileRevoked, agreementNotFound,
     rightToUseRevoked, usageProhibited, matchingConstraintOnAssignee,
     matchingConstraintOnTarget, timingConstraint, usageConstraint
- added deniedMetrics to denials to report the current stats that caused the denial
- minimalistic validation of input data on agreement and permission/prohibition
  to make sure they have the uid values on them.  Otherwise, LUM-server returns
  http status 400.  More validation is due later
- reports show the latest denials based on ODRL agreement (`ACUMOS-3229 <https://jira.acumos.org/browse/ACUMOS-3229>`_)
- jsdoc - work in progress

lum-database
............

- including softwareLicensorId as partial PK on assetUsageAgreement, rightToUse,
  snapshot tables
- storing groomedAgreement in assetUsageAgreement
- changed PK on rightToUse to uuid (assetUsageRuleId) - not trusting
  rightToUseId received from outside LUM to be globally unique
- rightToUse now contains the groomed targetRefinement, assigneeRefinement,
  usageConstraints and assigneeMetrics - dicts to easily find the
  matching right-to-use for the swidTag
- removed the no longer needed tables swToRtu, matchingConstraint, usageConstraint

    * that was possible due to the new concept of merging the constraints
    * using SQL to find the matching rightToUse on the fly instead
    * using JSON functionality of Postgres
- renamed table rtuUsage to usageMetrics
- stroting LUM version into database table lumInfo



Version 0.25.2, 13 September 2019
---------------------------------

lum-server
..........

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
- added isUsedBySwCreator flag to assetUsage API and assetUsageHistory
- minor changes to API
- jsdoc - work in progress

Version 0.23.1, 11 September 2019
---------------------------------

lum-java-client
...............

- Fixed allOfWarnings - required changes to swagger
- bumped version to 0.23.1 for all components
- Removed user from lum-db setup
- Add support for development without docker

Version 0.23.0, 09 September 2019
---------------------------------

local dev setup fixes
.....................

- Setup NodeJS server to work without docker for quicker debugging
- adding .gitignore to not include local folders / files that are only for development

first incarnation of the lum-server with basic functionality of API
...................................................................

- improved API definition for lum-server (`ACUMOS-3342 <https://jira.acumos.org/browse/ACUMOS-3342>`_)
- openapi-ui on lum-server (`ACUMOS-3342 <https://jira.acumos.org/browse/ACUMOS-3342>`_)
- Posgres database initdb and setup (`ACUMOS-3006 <https://jira.acumos.org/browse/ACUMOS-3006>`_)
- defined DDL for the database (`ACUMOS-3006 <https://jira.acumos.org/browse/ACUMOS-3006>`_)

first iteration of APIs on lum-server
.....................................

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
....................

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
