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

=============================================
LUM - Application Programming Interface (API)
=============================================

LUM provides http based API under specification of `openapi 3.0.3 <https://swagger.io/specification/>`_.

----

**********************************
If lum-server is **not** installed
**********************************

  #. download :download:`lum-server-API.yaml <../lum-server/lum-server-api/lum-server-API.yaml>`
  #. use https://editor.swagger.io/ on the downloaded
     :download:`lum-server-API.yaml <../lum-server/lum-server-api/lum-server-API.yaml>`
     to see the API specification in UI.

.. warning::

  Do not execute any commands from inside https://editor.swagger.io/,
  because the swagger spec of LUM server only has a relative path to lum-server
  and that does not point to the running lum-server.

----

**************************************
If lum-server is installed and running
**************************************

  #. open the web browser of your choice
  #. navigate to the swagger ui web-page on the running lum-server at the url path
     ``/ui/openapi``.

.. tip::

  - For instance, if the lum-server is running at your ``localhost`` at port ``2080``,
    open http://localhost:2080/ui/openapi page in the web-browser.

  - If using a **reverse proxy** with the url like this https://localhost/lum/ pointing to
    lum-server, then

      - Open https://localhost/lum/ui/openapi page in the web-browser
        (append ``/ui/openapi`` to ``/lum`` path of the lum-server).
      - Change ``Servers`` selector from default ``"/ - Root"`` to
        ``"/lum - Helm Chart with ingress"`` (going through the reverse proxy)
        on that page to be able to execute the commands against the running lum-server.

----

See :doc:`asset-usage-denials` for the list of possible denials on asset-usage request

----

:doc:`back to LUM index <index>`
