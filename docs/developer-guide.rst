.. ===============LICENSE_START=======================================================
.. Acumos CC-BY-4.0
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

.. _developer-guide-template:

=======================================
License Usage Manager - Developer Guide
=======================================

Overview
========

LUM is intended for answering the question on whether the specific
action on the software asset is **entitled** by software licensor
according to the right-to-use provided by an agreement between
the software licensor (supplier) and the software licensee
(subscriber).

- LUM expects the software-management-system (Acumos) to globally identify
  the software up to its unique version and provide the software-identifying
  tag data (**swidTag**) along with the **license-profile** to LUM.
  License-management-client in Acumos is responsible for determining
  whether the swidTag **requires the right-to-use** or not.
  Open source software usually does not require the right-to-use from the licensor.
- LUM expects the software-management-system (License-management-client
  in Acumos) to identify the software **asset usage**.
  In other words, it is Acumos's
  responsibility to differentiate between separate **copies** of the
  software and come up with globally unique identifier for the
  asset-usage of that specific copy of the software.
- Open Digital Rights Language (`ODRL <https://www.w3.org/TR/odrl-model/>`_)
  is used for defining the agreement/entitlement with multiple permission
  rules - rights-to-use that contain multiple constraints/limits.
- The ODRL based agreement between the software licensor (supplier)
  and software licensee (subscriber) that contains one or more permissions
  and/or prohibition is expected to be uploaded to LUM through admin API.
- On request for entitlement of the asset-usage, LUM goes through the
  following sequence

    #. finds **swidTag** with the **license-profile** in LUM database
    #. identifies whether the the swidTag **requires the right-to-use** or not
    #. if the **right-to-use** is required, LUM finds the matching right-to-use
       (prohibition or permission) for the software and determines whether
       the asset-usage is entitled or not based on the constraints


Data model and High-Level Flow
==============================

    .. image:: images/lum_architecture.png

Technology and Frameworks
=========================

.. csv-table::
   :header: "framework", "version", "link"
   :widths: 10 5 20

    node.js, 10.16.3, https://nodejs.org
    express.js, 4.17.1, http://expressjs.com/
    node-postgres, 7.12.1, https://node-postgres.com/
    openapi, 3.0.2, https://swagger.io/specification/
    postgres database, 11.5, https://www.postgresql.org/

Project Resources
=================

- wiki `RTU Design (used by LUM) <https://wiki.acumos.org/pages/viewpage.action?pageId=20547102>`_
- wiki `ODRL based License-Usage-Manager (LUM) architecture <https://wiki.acumos.org/display/LM/ODRL+based+License-Usage-Manager+%28LUM%29+architecture>`_
- wiki `Open Digital Rights Language (ODRL) <https://wiki.acumos.org/pages/viewpage.action?pageId=20547401>`_
- Gerrit repo: `license-usage-manager <https://gerrit.acumos.org/r/gitweb?p=license-usage-manager.git;a=tree;h=refs/heads/master;hb=refs/heads/master>`_
- Jira `Develop License Use Manager (LUM) <https://jira.acumos.org/browse/ACUMOS-3005>`_
