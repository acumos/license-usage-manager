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

=======================================
License Usage Manager - Developer Guide
=======================================

Overview
========

License Usage Manager (LUM) is intended for answering the question on whether the specific
action on the software asset is **entitled** by software licensor
according to the right-to-use provided by an agreement between
the software licensor (supplier) and the software licensee
(subscriber).

- LUM expects the software-management-system (Acumos) to globally identify
  the software up to its unique version and provide the software-identifying
  tag data (**swidTag**) along with the **license-profile** to LUM.
  License-Manager-Client-Library (LMCL) in Acumos is responsible for determining
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

  .. note:: LUM only implements a subset of ODRL features that include
            agreement, permission, and prohibition.
            LUM does not support Logical Constraint and some other
            features of ODRL.
            Please refer to :doc:`LUM API <api-docs>` for more details.

  .. note:: However, LUM has its own set of additional values
            with the prefix ``lum:`` and a
            special operator ``lum:in`` to find the match in a list of
            ``rightOperand`` values.

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

    .. image:: images/lum-architecture.png

Selecting the right-to-use for the action on the asset of swidTag
-----------------------------------------------------------------

LUM does the following steps to select the ODRL based **prohibition** or **permission** for the **action** on the **swidTag**.

#. matches the **action** value received from Acumos versus the **action** on the right-to-use

  .. note:: each action is treated separately from any other action and has its own metrics.

#. matches the **softwareLicensorId** value on **swidTag** versus the **softwareLicensorId** on the right-to-use
#. matches **swidTag** to all the populated **refinements** on the **target** of the right-to-use

    .. list-table:: refinements on target
        :widths: 20 40 15
        :header-rows: 1

        * - match by
          - sample
          - comment
        * - **swPersistentId** is either "abc456" or "def789"
          - ``{"leftOperand": "lum:swPersistentId", "operator": "lum:in", "rightOperand": ["abc456", "def789"]}``
          - **solutionId** in Acumos
        * - **swTagId** is "xyz123"
          - ``{"leftOperand": "lum:swTagId", "operator": "lum:in", "rightOperand": ["xyz123"]}``
          - **revisionId** in Acumos
        * - **swProductName** is "Face Detection"
          - ``{"leftOperand": "lum:swProductName", "operator": "lum:in", "rightOperand": ["Face Detection"]}``
          - **model name** in Acumos
        * - **swCategory** is "image-processing"
          - ``{"leftOperand": "lum:swCategory", "operator": "lum:in", "rightOperand": ["image-processing"]}``
          - **category** is the model type in Acumos. Each model has a single model type
        * - **swCatalogId** is "XYZ models"
          - ``{"leftOperand": "lum:swCatalogId", "operator": "lum:in", "rightOperand": ["XYZ models"]}``
          - **catalogId** in Acumos
        * - **swCatalogType** is "restricted"
          - ``{"leftOperand": "lum:swCatalogType", "operator": "lum:in", "rightOperand": ["restricted"]}``
          - **catalogType** in Acumos

#. matches **user** to all the populated **refinements** on the **assignee** of the right-to-use

    .. list-table:: refinements on assignee
        :widths: 20 40 15
        :header-rows: 1

        * - match by
          - sample
          - comment
        * - **number of users**
          - ``{"leftOperand": "lum:countUniqueUsers", "operator": "lteq", "rightOperand": {"@value": "5", "@type": "xsd:integer"}}``
          - for constraint by count of users
        * - **restrict users** by the subscriber company
          - ``{"leftOperand": "lum:users", "operator": "lum:in", "rightOperand": ["alex", "justin", "michelle"]}``
          - set of unique userIds comes from agreement-restriction

#. verifies **timing** of the right-to-use.  Do not select the expired or not effective right-to-use - date in GMT timezone in ISO "CCYY-MM-DD" format

    .. list-table:: timing constraints on the right-to-use
        :widths: 20 40 15
        :header-rows: 1

        * - timing
          - sample
          - comment
        * - **enable on** specific GMT date
          - ``{"leftOperand": "date", "operator": "gteq", "rightOperand": {"@value": "2019-08-01", "@type": "xsd:date"}}``
          -
        * - **expire on** specific GMT date
          - ``{"leftOperand": "date", "operator": "lteq", "rightOperand": {"@value": "2019-12-31", "@type": "xsd:date"}}``
          - expires after "2019-12-31" in GMT timezone

#. verifies usage **count** on the permission for the specific **action**

    .. note:: please refer to :ref:`Acumos Right to Use Actions <../../../license-manager/docs/user-guide-license-rtu-editor.html#acumos-right-to-use-actions>`
              for the actual list of supported actions

    .. list-table:: usage constraints on permission
        :widths: 20 40 15
        :header-rows: 1

        * - count
          - sample
          - comment
        * - **action** "acumos:download"
          - ``{"action": "acumos:download", "constraint": [{"leftOperand": "count", "operator": "lteq", "rightOperand": {"@value": "25", "@type": "xsd:integer"}}]}``
          - download up to 25 times
        * - **action** "acumos:deploy"
          - ``{"action": "acumos:deploy", "constraint": [{"leftOperand": "count", "operator": "lteq", "rightOperand": {"@value": "35", "@type": "xsd:integer"}}]}``
          - deploy up to 35 times
        * - **action** in ["transfer", "aggregate"]
          - ``{"action": ["transfer", "aggregate"], "constraint": [{"leftOperand": "count", "operator": "lteq", "rightOperand": {"@value": "45", "@type": "xsd:integer"}}]}``
          - each action has a separate limit of 45

#. **picks** the first right-to-use after **ranking** them by the following criteria
    - most restrictive first by picking prohibitions before permissions
    - most recent last by ordering by rtu.created timestamp - prefering to pick older RTUs first

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

- Gerrit repo: `license-usage-manager <https://gerrit.acumos.org/r/gitweb?p=license-usage-manager.git;a=tree;h=refs/heads/master;hb=refs/heads/master>`_
- Jira: `Develop License Use Manager (LUM) <https://jira.acumos.org/browse/ACUMOS-3005>`_

:doc:`back to LUM index <index>`
