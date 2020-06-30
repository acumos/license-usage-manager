.. ===============LICENSE_START=======================================================
.. Acumos CC-BY-4.0
.. ===================================================================================
.. Copyright (C) 2019-2020 AT&T Intellectual Property. All rights reserved.
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

=====================
LUM - Developer Guide
=====================


******************************
Data model and high-level flow
******************************

  .. image:: images/lum-architecture.svg
     :width: 100%

-----

LUM does the following steps to select the `ODRL`_ based `prohibition`_ or `permission`_ for the `action`_ on the **swidTag**.
---------------------------------------------------------------------------------------------------------------------------------------------------------------------

#. LUM matches the **softwareLicensorId** value on **swidTag** versus the **softwareLicensorId** on the `right-to-use`_

#. LUM verifies **timing** of the `right-to-use`_.  Do not select the expired or not effective `right-to-use`_ -
   ``date`` in GMT timezone in ISO ``"CCYY-MM-DD"`` format

    .. list-table:: timing constraints on the `right-to-use`_
        :widths: 20 40 30
        :header-rows: 1

        * - timing
          - sample
          - comment
        * - **enable on** specific GMT ``date``
          - .. code-block:: json
              :emphasize-lines: 1, 2

              {"leftOperand": "date",
               "operator": "gteq",
               "rightOperand": {"@value": "2019-08-01",
                                "@type": "xsd:date"}}
          - `right-to-use`_ will start on ``"2019-08-01"`` in GMT timezone
        * - **expire on** specific GMT ``date``
          - .. code-block:: json
              :emphasize-lines: 1, 2

              {"leftOperand": "date",
               "operator": "lteq",
               "rightOperand": {"@value": "2019-12-31",
                                "@type": "xsd:date"}}
          - expires after ``"2019-12-31"`` in GMT timezone
        * - **"lum:goodFor"** for ``30 days`` or ``1 year``
          - .. code-block:: json
              :emphasize-lines: 1

              {"leftOperand": "lum:goodFor",
               "operator": "lteq",
               "rightOperand": {"@value": "30"}}

            or

            .. code-block:: json
              :emphasize-lines: 1

              {"leftOperand": "lum:goodFor",
               "operator": "lteq",
               "rightOperand": "P1Y"}

          - asset usage is good for the duration of ``30 days`` after the first entitlement by the `permission`_ on any `action`_.
            ``"P1Y"`` - for ``1 year``. ``rightOperand`` formatted either as `ISO-8601`_ for duration
            or just a number that is converted by LUM to days (``"30"`` -> ``"P30D"``)

    .. note:: **"lum:goodFor"**.

      * ``rightOperand`` is expected to be formatted as duration from `ISO-8601`_

      * `ISO-8601`_ formats for duration always start with ``P`` and put ``T`` to separate date from time -
        at least one number part is required, but any combination is ok:
        ``PnYnMnDTnHnMnS``, ``PnW`` ::

          "P30D" = 30 days,
          "P3Y6M4DT12H30M5S" = 3 years 6 mons 4 days 12:30:05,
          "P123.5DT23H" = 123 days 35:00:00,
          "P4.7Y" = 4 years 8 mons,
          "P1.3M" = 1 mon 9 days,
          "P1.55W" = 10 days 20:24:00,
          "P0.5Y" = 6 mons,
          "PT36H" = 36:00:00,
          "P1YT5S" = 1 year 00:00:05

      * in addition to `ISO-8601`_ format, when the value of the rightOperand is a stringified number,
        LUM assumes that is the duration in **days** (default)

        For instance, ``"30"`` is converted by LUM to ``"P30D"`` and is ``30 days``

        .. code-block:: json
          :emphasize-lines: 2

          { "leftOperand": "lum:goodFor", "operator": "lteq",
            "rightOperand": "30" }

        is the same as the following

        .. code-block:: json
          :emphasize-lines: 2

          { "leftOperand": "lum:goodFor", "operator": "lteq",
            "rightOperand": "P30D" }

#. LUM matches **swidTag** to all the populated `refinement`_ on the `target`_ of the `right-to-use`_

    .. list-table:: `refinement`_ on `target`_
        :widths: 20 40 30
        :header-rows: 1

        * - match by
          - sample
          - comment
        * - **swPersistentId** is either ``"abc456"`` or ``"def789"``
          - .. code-block:: json
              :emphasize-lines: 1

              {"leftOperand": "lum:swPersistentId",
               "operator": "lum:in",
               "rightOperand": ["abc456", "def789"]}
          - ``solutionId`` in Acumos
        * - **swTagId** is ``"xyz123"``
          - .. code-block:: json
              :emphasize-lines: 1

              {"leftOperand": "lum:swTagId",
               "operator": "lum:in",
               "rightOperand": ["xyz123"]}
          - ``revisionId`` in Acumos
        * - **swProductName** is ``"Face Detection"``
          - .. code-block:: json
              :emphasize-lines: 1

              {"leftOperand": "lum:swProductName",
               "operator": "lum:in",
               "rightOperand": ["Face Detection"]}
          - **model name** in Acumos
        * - **swCategory** is ``"image-processing"``
          - .. code-block:: json
              :emphasize-lines: 1

              {"leftOperand": "lum:swCategory",
               "operator": "lum:in",
               "rightOperand": ["image-processing"]}
          - **category** is the model type in Acumos. Each model has a single model type
        * - **swCatalogId** is ``"XYZ models"``
          - .. code-block:: json
              :emphasize-lines: 1

              {"leftOperand": "lum:swCatalogId",
               "operator": "lum:in",
               "rightOperand": ["XYZ models"]}
          - **catalogId** in Acumos
        * - **swCatalogType** is ``"restricted"``
          - .. code-block:: json
              :emphasize-lines: 1

              {"leftOperand": "lum:swCatalogType",
               "operator": "lum:in",
                "rightOperand": ["restricted"]}
          - **catalogType** in Acumos

#. LUM matches **user** to all the populated `refinement`_ on the `assignee`_ of the `right-to-use`_

    .. list-table:: `refinement`_ on `assignee`_
        :widths: 20 40 30
        :header-rows: 1

        * - match by
          - sample
          - comment
        * - **number of users**
          - .. code-block:: json
              :emphasize-lines: 1

              {"leftOperand": "lum:countUniqueUsers",
               "operator": "lteq",
               "rightOperand": {"@value": "5",
                                "@type": "xsd:integer"}}
          - for `constraint`_ by count of users
        * - **restrict users** by the subscriber company
          - .. code-block:: json
              :emphasize-lines: 1

              {"leftOperand": "lum:users",
               "operator": "lum:in",
               "rightOperand": ["alex",
                                "justin",
                                "michelle"]}
          - set of unique userIds comes from **agreement-restriction**

#. LUM matches the **action** value received from Acumos versus the `action`_ on the `right-to-use`_

#. LUM **verifies** the **usage** `count`_ on the `permission`_ for the specific `action`_

    .. list-table:: usage constraints on `permission`_
        :widths: 20 40 30
        :header-rows: 1

        * - `count`_
          - sample
          - comment
        * - **action** ``"acumos:download"``
          - .. code-block:: json
              :emphasize-lines: 1, 3, 5

              {"action": "acumos:download",
               "constraint": [
                 {"leftOperand": "count",
                  "operator": "lteq",
                  "rightOperand": {"@value": "25",
                                   "@type": "xsd:integer"}}]}
          - download up to ``25`` times
        * - **action** ``"acumos:deploy"``
          - .. code-block:: json
              :emphasize-lines: 1, 3, 5

              {"action": "acumos:deploy",
               "constraint": [
                 {"leftOperand": "count",
                  "operator": "lteq",
                  "rightOperand": {"@value": "35",
                                   "@type": "xsd:integer"}}]}
          - deploy up to ``35`` times
        * - **action** in ``["transfer", "aggregate"]``
          - .. code-block:: json
              :emphasize-lines: 1, 3, 5

              {"action": ["transfer", "aggregate"],
               "constraint": [
                 {"leftOperand": "count",
                  "operator": "lteq",
                  "rightOperand": {"@value": "45",
                                   "@type": "xsd:integer"}}]}
          - each action has a separate limit of ``45``

    .. note:: please refer to :doc:`Acumos Right to Use Actions <../../license-manager/docs/user-guide-license-rtu-editor>`
              for the actual list of supported actions

    .. note:: each `action`_ is treated separately from any other `action`_ and has its own usage `count`_ in **metrics**.

#. LUM **picks** the first `right-to-use`_ after **ranking/sorting** them by the following criteria
    - most restrictive first by picking `prohibition`_ **before** `permission`_
    - most recent last by ordering by rtu.created timestamp - prefering to
      **pick older** `right-to-use`_ first

#. LUM **increments** the **usage** `count`_ in the **metrics** per `action`_

----

.. _lum-framework:

*************************
Technology and frameworks
*************************

.. csv-table::
   :header: "framework", "version", "link"
   :widths: 10 5 20

    node.js, ``12.18.1``, https://nodejs.org
    express.js, ``4.17.1``, http://expressjs.com/
    node-postgres, ``8.2.1``, https://node-postgres.com/
    openapi, ``3.0.3``, https://swagger.io/specification/
    postgres database, ``11.5``, https://www.postgresql.org/

----

*****************
Project resources
*****************

- :doc:`api-docs`
- `Gerrit repo <https://gerrit.acumos.org/r/gitweb?p=license-usage-manager.git;a=tree;h=refs/heads/master;hb=refs/heads/master>`_
- `Jira <https://jira.acumos.org/browse/ACUMOS-3649>`_
- `LF Jenkins jobs <https://jenkins.acumos.org/view/license-usage-manager/>`_
- `LF Sonar reports <https://sonarcloud.io/dashboard?id=acumos_license-usage-manager>`_

----

:doc:`back to LUM index <index>`

.. _ISO-8601: https://en.wikipedia.org/wiki/ISO_8601#Durations
.. _ODRL: https://www.w3.org/TR/odrl-model/
.. _right-to-use: https://www.w3.org/TR/odrl-model/#rule
.. _permission: https://www.w3.org/TR/odrl-model/#permission
.. _prohibition: https://www.w3.org/TR/odrl-model/#prohibition
.. _action: https://www.w3.org/TR/odrl-model/#action
.. _constraint: https://www.w3.org/TR/odrl-model/#constraint
.. _refinement: https://www.w3.org/TR/odrl-vocab/#term-refinement
.. _count: https://www.w3.org/TR/odrl-vocab/#term-count
.. _target: https://www.w3.org/TR/odrl-model/#relation
.. _assignee: https://www.w3.org/TR/odrl-model/#function
