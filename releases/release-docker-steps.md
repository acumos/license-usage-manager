<!--
===============LICENSE_START=======================================================
Acumos
===================================================================================
Copyright (C) 2019 AT&T Intellectual Property. All rights reserved.
===================================================================================
This Acumos documentation file is distributed by AT&T
under the Creative Commons Attribution 4.0 International License (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

      http://creativecommons.org/licenses/by/4.0

This file is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
===============LICENSE_END=========================================================
-->

# release steps for docker containers

https://docs.releng.linuxfoundation.org/projects/global-jjb/en/latest/jjb/lf-release-jobs.html

each release*.yaml file should be submitted separately through gerrit

---

## change `releases/release-docker.yaml`

1. set the version number (here 0.27.0)

```yaml
container_release_tag: 0.27.0
containers:
    - name: lum-db
      version: 0.27.0
    - name: lum-server
      version: 0.27.0
```

2. get `ref` value from gerrit commit - id of the review

3. set ref in `releases/release-docker.yaml`

```yaml
ref: 3c57de93508fec01e19e895bd45177d971fae413
```

4. verify the docker build pushed the image into staging nexus

    - `releases/release-docker.yaml` contains the names and version
    - check that you are able to `docker pull` the docker image from container_pull_registry

```bash
docker pull nexus3.acumos.org:10004/acumos/lum-db:0.27.0

docker pull nexus3.acumos.org:10004/acumos/lum-server:0.27.0
```

## commit `releases/release-docker.yaml`

with proper commit message like `Release docker containers - LUM 0.27.0`

- +2 and submit it
- done

---
