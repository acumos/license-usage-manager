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

========================
LUM - Installation Guide
========================


********
Overview
********

License Usage Manager (LUM) is a standalone micro-service (``lum-server``)
with its own database (``lum-database``).

- :ref:`lum-birds-view` contains the high level overview on the integration of the ``lum-server`` with Acumos.
- :ref:`lum-framework` contains the details on the technologies used by the LUM services

----

Both ``lum-server`` and ``lum-database`` are dockerized and
should be deployed as docker containers.

docker ``images`` are stored in ``nexus`` repo at acumos.org

  - `lum-server image`_
  - `lum-database image`_

``lum-server`` container

  - exposes port ``2080`` for ``json`` based communication over ``http``
  - provides swagger-ui at the path of ``/ui/openapi``.
    See :doc:`api-docs`
  - can be preconfigured at startup to connect to the non-default ``lum-database`` container
    through providing ``etc/config.json`` mounted as volume and/or by providing
    environment variables like ``$DATABASE_PASSWORD``
  - is expected to be hidden behind the firewall and should not be exposed
    to a non-authorized access

``lum-database`` container

  - is a `Postgres`_ database with the schema
    dedicated to LUM
  - exposes the standard `Postgres`_ port ``5432``
  - expects the internal folder ``/var/lib/postgresql/data``
    to be mounted to a dedicated `docker volume`_ for persisting of the database data
  - is expected to be hidden behind the firewall and should not be exposed
    to a non-authorized access

.. note::

  Any technology that is based on `docker`_ can be used to deploy the LUM services.

  In this guide the instructions for `docker-compose`_ are provided.

----

*************
Prerequisites
*************

*Hardware and Software* Requirements

- Either one or two Linux based virtual machine(s) with running `docker-engine`_
- Ideally, the ``lum-database`` should be installed on a dedicated vm with
  dedicated reliable and high-performance `docker volume`_ for data storage

----

**************************
Preparing for Installation
**************************

Populate the ``docker-compose.yml``

#. pick the latest or specific **version** for LUM

    - find the version in the repo of `lum-server image`_ and `lum-database image`_
    - for these instructions let's assume we selected the version ``1.3.1``

    .. code-block:: yaml
      :emphasize-lines: 3,5

      services:
        lum-database:
          image: nexus3.acumos.org:10004/acumos/lum-db:1.3.1
        lum-server:
          image: nexus3.acumos.org:10004/acumos/lum-server:1.3.1
          depends_on:
            - lum-database

#. decide on and map the **external port** to the exposed port ``2080`` on ``lum-server``

    - for these instructions let's assume ``lum-server`` maps to external port ``8600``

    .. code-block:: yaml
      :emphasize-lines: 4

      lum-server:
        ...
        ports:
          - "8600:2080"

#. mount the **volumes**

    - letting ``lum-database`` to persist its database data to the precreated
      `docker volume`_ ``lum-data-volume`` on the hosting virtual machine
    - letting ``lum-server`` to write the log file ``log-acu/lum-server/lum-server.log``
      into precreated `docker volume`_ ``cognita-logs`` for ELK on Acumos platform

      .. code-block:: yaml
        :emphasize-lines: 5,10

        services:
          lum-database:
            ...
            volumes:
              - lum-data-volume:/var/lib/postgresql/data

          lum-server:
            ...
            volumes:
              - cognita-logs:/opt/app/lum/log-acu

        volumes:
          lum-data-volume:
            external: true
          cognita-logs:
            external: true

#. configure ``lum-server`` **clients** to find it at the selected port ``8600``

    - assuming ``lum-server`` runs at that external port ``8600``
    - assuming ``acumos-portal-be`` finds ``lum-server`` through the `docker-compose`_
      network

    .. code-block:: yaml
      :emphasize-lines: 5

      acumos-portal-be:
        environment:
          SPRING_APPLICATION_JSON: '{
              ...
              "lum": {"url" : "http://lum-server:8600"},
              ...
            }'

----

The resulting subset of ``docker-compose.yml`` that is related to LUM

.. code-block:: yaml

  version: "3.4"
  services:
    lum-database:
      image: nexus3.acumos.org:10004/acumos/lum-db:1.3.1
      ports:
        - "5432:5432"
      volumes:
        - lum-data-volume:/var/lib/postgresql/data
      restart: always

    lum-server:
      image: nexus3.acumos.org:10004/acumos/lum-server:1.3.1
      depends_on:
        - lum-database
      ports:
        - "8600:2080"
      volumes:
        - cognita-logs:/opt/app/lum/log-acu
      restart: always

    acumos-portal-be:
      environment:
        SPRING_APPLICATION_JSON: '{
            ...
            "lum": {"url" : "http://lum-server:8600"},
            ...
          }'

  volumes:
    lum-data-volume:
      external: true
    cognita-logs:
      external: true

----

Additional configuration options
++++++++++++++++++++++++++++++++

Advanced configuration of ``lum-database``
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

It is possibe to change the configuration of ``lum-database`` by providing
specific `Postgres environment variables`_ in ``docker-compose.yml``.  For instance,

.. code-block:: yaml
  :emphasize-lines: 5,6

  services:
    lum-database:
      ...
      environment:
        POSTGRES_USER: ${LUM_POSTGRES_USER}
        POSTGRES_PASSWORD: ${LUM_POSTGRES_PASSWORD}

----

Configuring the ``lum-server`` by ``etc/config.json`` file
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

``lum-server`` reads the ``/opt/app/lum/etc/config.json`` file at startup
as the source for the initial configuration.

  .. literalinclude:: ../lum-server/etc/config.json
    :language: json
    :linenos:

  .. list-table:: Field definition for ``etc/config.json`` file
    :widths: auto
    :header-rows: 1

    * - field
      - required
      - description
    * - .. code-block:: json
          :emphasize-lines: 1

          {"lumServer": {}}

      - required
      - top level
    * - .. code-block:: json
          :emphasize-lines: 2

          {"lumServer": {
            "database": {}}}

      - required
      - configuration of the database client
    * - .. code-block:: json
          :emphasize-lines: 2

          {"lumServer": {"database": {
            "user": "lumdb"}}}

      - required
      - database user must be ``lumdb`` to match the owner of the schema
        in ``lum-database``
    * - .. code-block:: json
          :emphasize-lines: 2

          {"lumServer": {"database": {
            "password": "lumdb"}}}

      - optional
      - database user password. When not provided, must be overriden
        by the environment variable ``DATABASE_PASSWORD``
    * - .. code-block:: json
          :emphasize-lines: 2

          {"lumServer": {"database": {
            "host": "lum-database"}}}

      - required
      - hostname of the database
    * - .. code-block:: json
          :emphasize-lines: 2

          {"lumServer": {"database": {
            "port": 5432}}}

      - required
      - port of the database
    * - .. code-block:: json
          :emphasize-lines: 2

          {"lumServer": {"database": {
            "max": 100}}}

      - optional
      - maximum number of clients the pool of connections to
        the database should contain.  By default this is set to 10
    * - .. code-block:: json
          :emphasize-lines: 2

          {"lumServer": {"database": {
            "idleTimeoutMillis": 30000}}}

      - optional
      - number of milliseconds a client must sit idle in the pool and not be checked out
        before it is disconnected from the backend and discarded.
        Default is 10000 (10 seconds) - set to 0 to disable auto-disconnection of idle clients
    * - .. code-block:: json
          :emphasize-lines: 2

          {"lumServer": {
            "serverName": "lum-server"}}

      - optional
      - the name of the ``lum-server`` to be used in logging and healthcheck.
        Defaults to ``lum-server``
    * - .. code-block:: json
          :emphasize-lines: 2

          {"lumServer": {
            "maxTxRetryCount": 10}}

      - optional
      - number of times the ``lum-server`` will retry to connect to the database or
        retry the dead-locked transaction. Defaults to 20
    * - .. code-block:: json
          :emphasize-lines: 2

          {"lumServer": {
            "logging": {}}}

      - optional
      - configure logging
    * - .. code-block:: json
          :emphasize-lines: 2

          {"lumServer": {"logging": {
            "logLevel": "debug"}}}

      - optional
      - log level in LUM server. enum: (error, warn, info, debug). Defaults to "info"
    * - .. code-block:: json
          :emphasize-lines: 2

          {"lumServer": {"logging": {
            "logTo": {}}}}

      - optional
      - collection of loggers to turn off or on in LUM server
    * - .. code-block:: json
          :emphasize-lines: 3

          {"lumServer":
            {"logging": {"logTo": {
              "console": true}}}}

      - optional
      - logging the dev info to console. Defaults to ``true``
    * - .. code-block:: json
          :emphasize-lines: 3

          {"lumServer":
            {"logging": {"logTo": {
              "devLog": true}}}}

      - optional
      - whether to log the dev info into file ``logs/dev_lum-server.log``
        in LUM's internal format.
        Defaults to ``false``.
        When a non empty environment variable ``$LOGDIR`` is provided, defaults to ``true``.
    * - .. code-block:: json
          :emphasize-lines: 3

          {"lumServer":
            {"logging": {"logTo": {
              "healthcheck": true}}}}

      - optional
      - whether to log healthcheck into file ``logs/healthcheck_lum-server.log``.
        Defaults to ``false``.
        When a non empty environment variable ``$LOGDIR`` is provided, defaults to ``true``.
    * - .. code-block:: json
          :emphasize-lines: 3

          {"lumServer":
            {"logging": {"logTo": {
              "acumos": true}}}}

      - optional
      - whether to log info in Acumos specific format (json)
        to file ``log-acu/lum-server/lum-server.log``.
        Defaults to ``true``.

----

Overriding the ``etc/config.json`` file in ``lum-server`` container
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

When required, the default internal file ``etc/config.json`` can be substituted
in the ``lum-server`` container through the docker `volume mounting`_ mechanism.

  For instance, the local read-only file ``../config/lum-config.json`` from the
  hosting virtual machine is used by ``lum-server`` instead of the default internal
  file ``/opt/app/lum/etc/config.json``

.. code-block:: yaml
  :emphasize-lines: 6

  services:
    lum-server:
      ...
      volumes:
        ...
        - ../config/lum-config.json:/opt/app/lum/etc/config.json:ro

----

Changing the ``lumdb`` user password in ``lum-server``
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

In case the password of the schema owner ``lumdb`` has changed from the default value,
the new value ``${LUMDB_PASSWORD}`` can be provided to ``lum-server``
through environment variable ``DATABASE_PASSWORD``.
The environment variable ``DATABASE_PASSWORD`` will override the value of
``lumServer.database.password`` field taken from ``etc/config.json`` file.

.. code-block:: yaml
  :emphasize-lines: 5

  services:
    lum-server:
      ...
      environment:
        DATABASE_PASSWORD: ${LUMDB_PASSWORD}

.. note:: currently, the ``initdb`` scripts do not provide the automated
          way to change the password for ``lumdb`` user in ``lum-database``

----

************
Installation
************

Use the `docker-compose`_ ``up`` command from the folder that contains ``docker-compose.yml``

  .. code-block:: shell

    docker-compose up -d

----

**************************
Verifying the Installation
**************************

.. tip::

  Assuming that the hostname of the virtual machine is ``my-acumos-vm.mycompany.com``
  and that the ``lum-server`` runs at that external port ``8600``

get the ``healthcheck`` of the ``lum-server``
+++++++++++++++++++++++++++++++++++++++++++++

.. code-block:: shell

  curl -X GET "http://my-acumos-vm.mycompany.com:8600/"

The sample ``healthcheck`` response

.. code-block:: json
  :emphasize-lines: 4

  {
    "requestId": "10fff4f5-f731-4ccc-8ed7-58397741a418",
    "requested": "2020-04-23T17:23:56.584Z",
    "healthcheck": {
      "serverName": "lum-server",
      "serverVersion": "1.3.3",
      "apiVersion": "1.3.3",
      "nodeVersion": "12.18.0",
      "databaseInfo": {
        "pgVersion": "PostgreSQL 11.5 on x86_64-pc-linux-musl, compiled by gcc (Alpine 8.3.0) 8.3.0, 64-bit",
        "databaseVersion": "0.28.2",
        "schemaCreated": "2020-01-09T17:12:31.791Z",
        "schemaModified": "2020-01-09T17:12:31.791Z",
        "databaseStarted": "2020-03-02T15:27:31.590Z",
        "databaseUptime": "52 days 01:56:24.999634",
        "checked": "2020-04-23T17:23:56.589Z"
      },
      "serverRunInstanceId": "d3c8d742-4402-4384-aebf-d4d04fe1b6bc",
      "serverStarted": "2020-04-21T18:53:14.137Z",
      "serverUptime": "1 day 22:30:42.481911",
      "pathToOpenapiUi": "/ui/openapi"
    }
  }

----

****************************************
Optional Post Installation Configuration
****************************************

.. tip::

  Assuming that the hostname of the virtual machine is ``my-acumos-vm.mycompany.com``
  and that the ``lum-server`` runs at that external port ``8600``

Get current config of the ``lum-server``
++++++++++++++++++++++++++++++++++++++++

.. code-block:: shell

  curl -X GET "http://my-acumos-vm.mycompany.com:8600/admin/config"

The sample GET ``/admin/config`` response

.. code-block:: json
  :emphasize-lines: 4

  {
    "requestId": "37f61860-be03-4bef-a53d-32f51f82fb29",
    "requested": "2020-04-23T16:36:22.536Z",
    "config": {
      "database": {
        "user": "lumdb",
        "password": "hmac(8e97a9ac003fccfd332b)",
        "host": "lum-database",
        "database": "lumdb",
        "port": 5432,
        "max": 100,
        "idleTimeoutMillis": 30000
      },
      "serverName": "lum-server",
      "maxTxRetryCount": 10,
      "logging": {
        "logLevel": "info",
        "logTo": {
          "console": true,
          "devLog": "/opt/app/lum/logs/dev_lum-server.log",
          "healthcheck": "/opt/app/lum/logs/healthcheck_lum-server.log",
          "acumos": "/opt/app/lum/log-acu/lum-server/lum-server.log"
        }
      },
      "port": 2080
    }
  }

Change the log level and log destination on the ``lum-server``
++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

The following request will change the log level to ``debug`` and
turn off logging of ``healthcheck``

.. code-block:: shell
  :emphasize-lines: 4,5

  curl -X PUT "http://my-acumos-vm.mycompany.com:8600/admin/config" \
  -H  "accept: application/json; charset=utf-8" \
  -H  "Content-Type: application/json; charset=utf-8" \
  -d "{\"config\":{\"logging\":{\"logLevel\":\"debug\", \
       \"logTo\":{\"healthcheck\":false,\"acumos\":true}}}}"

The sample PUT ``/admin/config`` response

.. code-block:: json
  :emphasize-lines: 17, 21

  {
    "requestId": "5f6efc69-bbad-4418-8ccd-f82501f0b278",
    "requested": "2020-04-23T17:33:23.800Z",
    "config": {
      "database": {
        "user": "lumdb",
        "password": "hmac(8e97a9ac003fccfd332b)",
        "host": "lum-database",
        "database": "lumdb",
        "port": 5432,
        "max": 100,
        "idleTimeoutMillis": 30000
      },
      "serverName": "lum-server",
      "maxTxRetryCount": 10,
      "logging": {
        "logLevel": "debug",
        "logTo": {
          "console": true,
          "devLog": "/opt/app/lum/logs/dev_lum-server.log",
          "healthcheck": false,
          "acumos": "/opt/app/lum/log-acu/lum-server/lum-server.log"
        }
      },
      "port": 2080
    }
  }

----

*********************************
Upgrading From a Previous Release
*********************************

.. note:: The database schema of ``lum-database`` was **not** changed in Demeter release
          in comparison to Clio release. This might not be the case in the future.

----

************
Uninstalling
************

Use the `docker stop`_ or `docker-compose`_ ``down`` and related commands to stop and remove
the containers and images and volumes.

.. danger::

  Only if you do **not** need the database data anymore -
  then manually remove the files from precreated volumes like ``lum-data-volume``
  by OS commands like ``rm -rf``.

----

:doc:`back to LUM index <index>`

.. links

.. _lum-server image: https://nexus3.acumos.org/#browse/browse:docker.release:v2%2Facumos%2Flum-server%2Ftags
.. _lum-database image: https://nexus3.acumos.org/#browse/browse:docker.public:v2%2Facumos%2Flum-db%2Ftags
.. _Postgres: https://www.postgresql.org/
.. _docker: https://www.docker.com/
.. _volume mounting: https://docs.docker.com/compose/compose-file/#volumes
.. _docker volume: https://docs.docker.com/engine/reference/commandline/volume_create/
.. _docker-compose: https://docs.docker.com/compose/
.. _docker-engine: https://docs.docker.com/get-started/overview/#docker-engine
.. _docker stop: https://docs.docker.com/engine/reference/commandline/stop/
.. _Postgres environment variables: https://github.com/docker-library/docs/tree/master/postgres/#environment-variables
