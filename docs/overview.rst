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


********
Overview
********

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
  #. the indication on ``swidTag`` of whether the `right-to-use`_ is required for asset usage
     ``isRtuRequired`` that is found in the license profile of the software
  #. when ``isRtuRequired==true``, LUM also needs to have the `agreement`_ provided from supplier
     to the subscriber that contains one or many `right-to-use`_ items (`permission`_ and/or
     `prohibition`_) that `target`_ the ``swidTag`` and limiting the user usage through
     `constraint`_ on `assignee`_, limiting the ``time`` of usage through the enable-on `constraint`_
     and/or the expire-on `constraint`_, as well as limiting the usage ``count`` for each `action`_
     on the asset usage identified by ``assetUsageId``

-----

********************************************************************
Integration and interaction of LUM-server with Acumos and RTU-editor
********************************************************************

.. _lum-birds-view:

The birds-view of the licensing process in Acumos
-------------------------------------------------

  .. image:: images/lum-in-acumos.svg
     :width: 100%

-----

Description of the user licensing activities in Acumos and its busness supporting systems (BSS)
-----------------------------------------------------------------------------------------------

  .. list-table:: **creator** of the model **onboards** the model to Acumos on supplier side
      :widths: 10 10 10 10 40
      :header-rows: 1

      * - step
        - action
        - supplier or subscriber
        - user role or component
        - activity description
      * - c1
        - onboard
        - supplier
        - creator
        - model creator creates the model and globally identifies it with ``swidTag``.
          Optionally, the creator can also provide the license profile
      * - c2
        - onboard
        - supplier
        - creator
        - model creator onboards the model and ``swidTag`` into Acumos

-----

  .. list-table:: **publisher** of the model **publishes or federates** the model from supplier to subscriber
      :widths: 10 10 10 10 40
      :header-rows: 1

      * - step
        - action
        - supplier or subscriber
        - user role or component
        - activity description
      * - p1
        - prepare
        - supplier
        - publisher
        - model publisher uses the **license-profile-editor** to fill out the license profile
          and specify ``isRtuRequired``
      * - p2 and p3
        - publish or federate
        - supplier
        - publisher
        - model publisher uploads the license profile into Acumos and initiates the publish or federate
          action on the model
      * - p4
        - publish or federate
        - supplier
        - :doc:`LMCL <../../license-manager/docs/index>` inside **Acumos-1**
        - registers the software in **LUM-server-1** by sending ``swidTag`` and ``isRtuRequired``
      * - p5, p6, p7
        - publish or federate
        - supplier
        - **Acumos-1**
        - sends the **model**, ``swidTag``, and the **license-profile** with ``isRtuRequired`` to
          **Acumos-2** on supplier (licensee) side through the Acumos peer-to-peer tunnel
      * - p8
        - publish or federate
        - subscriber
        - **Acumos-2**
        - receives the **model**, ``swidTag``, and the **license-profile** with ``isRtuRequired``
      * - p9
        - publish or federate
        - subscriber
        - **Acumos-2**
        - registers the software in **LUM-server-2** by sending ``swidTag`` and ``isRtuRequired``

-----

  .. list-table:: **user** of the model requests to perform an `action`_ on the model
      :widths: 10 10 10 10 40
      :header-rows: 1

      * - step
        - action
        - supplier or subscriber
        - user role or component
        - activity description
      * - u1
        - request
        - subscriber
        - user
        - model user is trying to perform an action on the model in **Acumos-2**
      * - u2
        - ask for entitlement
        - subscriber
        - :doc:`LMCL <../../license-manager/docs/index>` inside **Acumos-2**
        - asks **LUM-server-2** whether the **asset-usage** with `action`_ is entitled
          for the ``userId`` on ``assetUsageId`` with software identifier ``swTagId``
          (``revisionId`` in Acumos)
      * - u2
        - yes or no
        - subscriber
        - **LUM-server-2**
        - **LUM-server-2** answers with yes or no
      * - u2
        - allow or error
        - subscriber
        - :doc:`LMCL <../../license-manager/docs/index>` inside **Acumos-2**
        - if the asset usage is not entitled, an error with denial(s) is shown to the user.
          If the asset usage is entitled, :doc:`LMCL <../../license-manager/docs/index>`
          allows **Acumos-2** to perform the action.

-----

  .. list-table:: **sales rep** creates the **agreement** with `right-to-use`_ on supplier side
      :widths: 10 10 10 10 40
      :header-rows: 1

      * - step
        - action
        - supplier or subscriber
        - user role or component
        - activity description
      * - s1
        - open :doc:`RTU-editor <../../license-manager/docs/user-guide-license-rtu-editor>`
          in browser
        - supplier
        - sales rep
        - open :doc:`RTU-editor <../../license-manager/docs/user-guide-license-rtu-editor>`
          web page from **RTU-Editor-web-server-1**
      * - s2
        - open :doc:`RTU-editor <../../license-manager/docs/user-guide-license-rtu-editor>`
          in browser
        - supplier
        - sales rep
        - open :doc:`RTU-editor <../../license-manager/docs/user-guide-license-rtu-editor>`
          web page is served by **RTU-Editor-web-server-1**
      * - s2
        - :doc:`RTU-editor <../../license-manager/docs/user-guide-license-rtu-editor>`
          in browser
        - supplier
        - sales rep
        - enter agreement with the `right-to-use`_ into the
          :doc:`RTU-editor <../../license-manager/docs/user-guide-license-rtu-editor>`
          web page
      * - s3
        - download
        - supplier
        - sales rep
        - download the agreement with the `right-to-use`_ into the RTU-agreement.json file
      * - s4
        - send
        - supplier
        - sales rep
        - send the email with the attached RTU-agreement.json file to **subscriber**

-----

  .. list-table:: **RTU rep** uploades the **agreement** with the `right-to-use`_ into LUM
      :widths: 10 10 10 10 40
      :header-rows: 1

      * - step
        - action
        - supplier or subscriber
        - user role or component
        - activity description
      * - r1
        - receive
        - subscriber
        - RTU rep
        - receives the email with the attached RTU-agreement.json file from the **supplier**
      * - r2
        - open :doc:`RTU-editor <../../license-manager/docs/user-guide-license-rtu-editor>`
          in browser
        - subscriber
        - RTU rep
        - open :doc:`RTU-editor <../../license-manager/docs/user-guide-license-rtu-editor>`
          web page from **RTU-Editor-web-server-2**
      * - r3
        - open :doc:`RTU-editor <../../license-manager/docs/user-guide-license-rtu-editor>`
          in browser
        - subscriber
        - RTU rep
        - open :doc:`RTU-editor <../../license-manager/docs/user-guide-license-rtu-editor>`
          web page is served by **RTU-Editor-web-server-2**
      * - r4
        - import
        - subscriber
        - RTU rep
        - import the RTU-agreement.json into the
          :doc:`RTU-editor <../../license-manager/docs/user-guide-license-rtu-editor>`
          web page
      * - r4
        - verify
        - subscriber
        - RTU rep
        - verify the agreement with the `right-to-use`_ in the
          :doc:`RTU-editor <../../license-manager/docs/user-guide-license-rtu-editor>`
          web page
      * - r5
        - save
        - subscriber
        - RTU rep
        - save the agreement with the `right-to-use`_ into **LUM-server-2**

-----

  .. list-table:: alternative: **admin** uploades the **agreement** with the `right-to-use`_ into LUM
      :widths: 10 10 10 10 40
      :header-rows: 1

      * - step
        - action
        - supplier or subscriber
        - user role or component
        - activity description
      * - r1
        - receive
        - subscriber
        - RTU rep
        - receives the email with the attached RTU-agreement.json file from the **supplier**
      * - a1
        - hand it to admin
        - subscriber
        - RTU rep + LUM admin
        - RTU rep hands the RTU-agreement.json file to **LUM admin**
      * - a2
        - http PUT through **swagger-ui**
        - subscriber
        - LUM admin
        - **LUM admin** uploads the content of the RTU-agreement.json file into **LUM-server-2**
          through **swagger-ui** on **LUM-server-2**.  See :doc:`api-docs`

----

*****************************
LUM assumptions and functions
*****************************

- LUM expects the software-management-system (Acumos) to globally identify
  the software up to its unique version and provide the software-identifying
  tag data (**swidTag**) along with the **license-profile** to LUM.
  License-Manager-Client-Library (:doc:`LMCL <../../license-manager/docs/index>`)
  in Acumos is responsible for determining whether the swidTag **requires** the
  `right-to-use`_ or not. Open source software usually does not require the
  `right-to-use`_ from the licensor.
- LUM expects the software-management-system (License-management-client
  in Acumos) to identify the software **asset usage**. In other words, it is Acumos's
  responsibility to differentiate between separate **copies** of the software and
  come up with globally unique identifier for the asset-usage of that specific
  copy of the software.
- Open Digital Rights Language (`ODRL`_)
  is used for defining the `agreement`_/entitlement with multiple `permission`_
  rules - rights-to-use that contain multiple `constraint`_/limits.

  .. note::

    #. LUM only implements a subset of `ODRL`_ features that include
       `agreement`_, `permission`_, and `prohibition`_.
    #. LUM does not support `logical constraint`_ and some other features of `ODRL`_.
       Please refer to :doc:`LUM API <api-docs>` for more details.
    #. However, LUM has its own set of additional values with the prefix ``lum:``
       and a special operator ``lum:in`` to find the match in a list of
       ``rightOperand`` values.

- The `ODRL`_ based `agreement`_ between the software licensor (supplier)
  and software licensee (subscriber) that contains one or more `permission`_
  and/or `prohibition`_ is expected to be uploaded to LUM through admin API.
- On request for entitlement of the asset-usage, LUM goes through the
  following sequence

    #. finds **swidTag** with the **license-profile** in LUM database
    #. identifies whether the swidTag **requires** the `right-to-use`_ or not
    #. if the `right-to-use`_ is required, LUM finds the matching `right-to-use`_
       (`prohibition`_ or `permission`_) for the software and determines whether
       the asset-usage is entitled or not based on the `constraint`_

----

:doc:`back to LUM index <index>`

.. _ODRL: https://www.w3.org/TR/odrl-model/
.. _agreement: https://www.w3.org/TR/odrl-model/#policy-agreement
.. _right-to-use: https://www.w3.org/TR/odrl-model/#rule
.. _permission: https://www.w3.org/TR/odrl-model/#permission
.. _prohibition: https://www.w3.org/TR/odrl-model/#prohibition
.. _action: https://www.w3.org/TR/odrl-model/#action
.. _constraint: https://www.w3.org/TR/odrl-model/#constraint
.. _logical constraint: https://www.w3.org/TR/odrl-model/#constraint-logical
.. _target: https://www.w3.org/TR/odrl-model/#relation
.. _assignee: https://www.w3.org/TR/odrl-model/#function
