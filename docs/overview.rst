.. ===============LICENSE_START=======================================================
.. Acumos CC-BY-4.0
.. ===================================================================================
.. Copyright (C) 2020 AT&T Intellectual Property. All rights reserved.
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

======================================
License Usage Manager (LUM) - Overview
======================================


Overview
========

License Usage Manager (LUM) is a standalone micro-service with its own database.
LUM is intended for answering the question on whether the specific action on the software
asset is **entitled** for specific user.
From licensing point of view, the company that uses Acumos can either be the software licensor
(supplier) that produces the software (model) or the licensee (subscriber) that consumes the
software (model).

For LUM to answer the question on whether the user is entitled to perform an action on the software asset,
it needs to have the following information

  #. the software identifying tag information ``swidTag``.  The key to ``swidTag`` record is
     ``swTagId`` that is the same as the ``revisionId`` in Acumos
  #. the indication on ``swidTag`` of whether the right-to-use is required for asset usage
     ``isRtuRequired`` that is found in the license profile of the software
  #. when ``isRtuRequired==true``, LUM also needs to have the **agreement** provided from supplier
     to the subscriber that contains one or many **right-to-use** items (permission and/or prohibition)
     **targeted** to the ``swidTag`` and limiting the user usage through **assignee**, limiting the
     **time** of usage through enable-on + expire-on constraints, as well as limiting the usage **count**
     for each **action** on the asset usage identified by ``assetUsageId``


Integration and interaction of LUM-server with Acumos and RTU-Editor
====================================================================

The bird-view of the licensing process in Acumos
--------------------------------------------------------

  .. image:: images/lum-in-acumos.svg
     :width: 100%

Description of the user licensing activities in Acumos and its busness supporting systems (BSS)
-----------------------------------------------------------------------------------------------

  .. list-table:: **creator** of the model **onboards** the model to Acumos on supplier side
      :widths: 10 10 10 10 40
      :header-rows: 1

      * - supplier or subscriber
        - user role or component
        - activity action
        - activity step
        - activity description
      * - supplier
        - creator
        - c1
        - onboard
        - model creator creates the model and globally identifies it with ``swidTag``.
          Optionally, the creator can also provide the license profile
      * - supplier
        - creator
        - c2
        - onboard
        - model creator onboards the model and ``swidTag`` into Acumos

  .. list-table:: **publisher** of the model **publishes or federates** the model from supplier to subscriber
      :widths: 10 10 10 10 40
      :header-rows: 1

      * - supplier or subscriber
        - user role or component
        - activity action
        - activity step
        - activity description
      * - supplier
        - publisher
        - p1
        - prepare
        - model publisher uses the **license-profile-editor** to fill out the license profile
          and specify ``isRtuRequired``
      * - supplier
        - publisher
        - p2 and p3
        - publish or federate
        - model publisher uploads the license profile into Acumos and initiates the publish or federate
          action on the model
      * - supplier
        - **LMCL** inside **Acumos-1**
        - p4
        - publish or federate
        - registers the software in **LUM-server-1** by sending ``swidTag`` and ``isRtuRequired``
      * - supplier
        - **Acumos-1**
        - p5, p6, p7
        - publish or federate
        - sends the **model**, ``swidTag``, and the **license-profile** with ``isRtuRequired`` to
          **Acumos-2** on supplier (licensee) side through the Acumos peer-to-peer tunnel
      * - subscriber
        - **Acumos-2**
        - p8
        - publish or federate
        - receives the **model**, ``swidTag``, and the **license-profile** with ``isRtuRequired``
      * - subscriber
        - **Acumos-2**
        - p9
        - publish or federate
        - registers the software in **LUM-server-2** by sending ``swidTag`` and ``isRtuRequired``

  .. list-table:: **user** of the model requests to perform an **action** on the model
      :widths: 10 10 10 10 40
      :header-rows: 1

      * - supplier or subscriber
        - user role or component
        - activity action
        - activity step
        - activity description
      * - subscriber
        - user
        - u1
        - request
        - model user is trying to perform an action on the model in **Acumos-2**
      * - subscriber
        - **LMCL** inside **Acumos-2**
        - u2
        - ask for entitlement
        - asks **LUM-server-2** whether the **asset-usage** with ``action`` is entitled
          for the ``userId`` on ``assetUsageId`` with software identifier ``swTagId``
          (``revisionId`` in Acumos)
      * - subscriber
        - **LUM-server-2**
        - u2
        - yes or no
        - **LUM-server-2** answers with yes or no
      * - subscriber
        - **LMCL** inside **Acumos-2**
        - u2
        - allow or error
        - if the asset usage is not entitled, an error with denial(s) is shown to the user.
          If the asset usage is entitled, **LMCL** allows **Acumos-2** to perform the action.



  .. list-table:: **sales rep** creates the **agreement** with right-to-use on supplier side
      :widths: 10 10 10 10 40
      :header-rows: 1

      * - supplier or subscriber
        - user role or component
        - activity action
        - activity step
        - activity description
      * - supplier
        - sales rep
        - s1
        - open RTU-Editor in browser
        - open RTU-Editor web page from **RTU-Editor-web-server-1**
      * - supplier
        - sales rep
        - s2
        - open RTU-Editor in browser
        - open RTU-Editor web page is served by **RTU-Editor-web-server-1**
      * - supplier
        - sales rep
        - s2
        - RTU-Editor in browser
        - enter agreement with the right-to-use into the RTU-Editor web page
      * - supplier
        - sales rep
        - s3
        - download
        - download the agreement with the right-to-use into the RTU-agreement.json file
      * - supplier
        - sales rep
        - s4
        - send
        - send the email with the attached RTU-agreement.json file to **subscriber**

  .. list-table:: **RTU rep** uploades the **agreement** with the right-to-use into LUM
      :widths: 10 10 10 10 40
      :header-rows: 1

      * - supplier or subscriber
        - user role or component
        - activity action
        - activity step
        - activity description
      * - subscriber
        - RTU rep
        - r1
        - receive
        - receives the email with the attached RTU-agreement.json file from the **supplier**
      * - subscriber
        - RTU rep
        - r2
        - open RTU-Editor in browser
        - open RTU-Editor web page from **RTU-Editor-web-server-2**
      * - subscriber
        - RTU rep
        - r3
        - open RTU-Editor in browser
        - open RTU-Editor web page is served by **RTU-Editor-web-server-2**
      * - subscriber
        - RTU rep
        - r4
        - import
        - import the RTU-agreement.json into the RTU-Editor web page
      * - subscriber
        - RTU rep
        - r4
        - verify
        - verify the agreement with the right-to-use in the RTU-Editor web page
      * - subscriber
        - RTU rep
        - r5
        - save
        - save the agreement with the right-to-use into **LUM-server-2**

  .. list-table:: alternative: **admin** uploades the **agreement** with the right-to-use into LUM
      :widths: 10 10 10 10 40
      :header-rows: 1

      * - supplier or subscriber
        - user role or component
        - activity action
        - activity step
        - activity description
      * - subscriber
        - RTU rep
        - r1
        - receive
        - receives the email with the attached RTU-agreement.json file from the **supplier**
      * - subscriber
        - RTU rep + LUM admin
        - a1
        - hand it to admin
        - RTU rep hands the RTU-agreement.json file to **LUM admin**
      * - subscriber
        - LUM admin
        - a2
        - http PUT through **swagger-ui**
        - **LUM admin** uploads the content of the RTU-agreement.json file into **LUM-server-2**
          through **swagger-ui** on **LUM-server-2**


LUM assumptions and functions
=============================

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
    #. identifies whether the swidTag **requires the right-to-use** or not
    #. if the **right-to-use** is required, LUM finds the matching right-to-use
       (prohibition or permission) for the software and determines whether
       the asset-usage is entitled or not based on the constraints


:doc:`back to LUM index <index>`
