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

# release steps for maven jars

https://docs.releng.linuxfoundation.org/projects/global-jjb/en/latest/jjb/lf-release-jobs.html

---

## on the gerrit review

1. on gerrit review - reply with the following line to run the staging

`stage-release`

here is the sample output of successful staging

```yaml
Build Successful

https://jenkins.acumos.org/job/license-usage-manager-client-maven-stage-master/23/ : SUCCESS
```

2. after `stage-release` finished, get the `log_dir` for maven release from Acumos Jobbuilder

    - that is the part of path in url that follows `job/`

    (`license-usage-manager-client-maven-stage-master/23/`)

---

## change `releases/release-maven-jar.yaml`

1. set the version number (here 0.27.0)

```yaml
version: 0.27.0
```

2. set log_dir to output of the `stage-release` job (see above)

```yaml
log_dir: license-usage-manager-client-maven-stage-master/23/
```

## commit `releases\release-maven-jar.yaml`

with proper commit message like `Release maven jar - LUM 0.27.0`

- +2 and submit it
- done

---
