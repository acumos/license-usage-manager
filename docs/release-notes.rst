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

Version 0.18.0, 26 August 2019
==============================

defining LUM API in lum_server-API.yaml (`ACUMOS-1270 <https://jira.acumos.org/browse/ACUMOS-3342/>`_)
* fix for tracking
* not using oneOf that breaks the java code gen
* merged softwareCreators into swid-tag as swCreators [userId]
* using http code 204 with no body for record not found
* = header fields are returned for requestId, requested, status, params
* using http code 224 for record revoked
* req body for revoke-delete - should we use header instead ?
* healthcheck api
* removed userRole and userInfo
* asset-usage-agreement - better structure
* asset-usage-agreement-restriction - improvements
* asset-usage-event data
* having revision numbers on responses
