#!/bin/bash
# ===================================================================
# Copyright (c) 2019 AT&T Intellectual Property. All rights reserved.
# ===================================================================
# Unless otherwise specified, all software contained herein is licensed
# under the Apache License, Version 2.0 (the "License");
# you may not use this software except in compliance with the License.
# You may obtain a copy of the License at
#
#             http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
# ============LICENSE_END============================================

PGVER=11.5

PGHOME=$(pwd)
PGPASSWORD=$(uuidgen)
PGIMAGE=postgres:${PGVER}-alpine

APPNAME=lumdb-pg

mkdir -p ${PGHOME}/logs
mkdir -p ${PGHOME}/pgdata
mkdir -p ${PGHOME}/initdb
chmod a+x ${PGHOME}/*

LOG_FILE=${PGHOME}/logs/$(date +%Y_%m%d-%H%M%S)_${APPNAME}_run.log
exec &> >(tee -a ${LOG_FILE})

echo "$(date +%Y-%m-%d_%T.%N): running ${BASH_SOURCE[0]}"

docker stop ${APPNAME}
docker rm -v ${APPNAME}

if [[ "$(docker images -q ${PGIMAGE} 2> /dev/null)" == "" ]]; then
    echo "docker pull ${PGIMAGE}"
    docker pull ${PGIMAGE}
fi

echo "docker run ${APPNAME}"
docker run -d \
    --name ${APPNAME} \
    --user "$(id -u):$(id -g)" \
    -p 5432:5432 \
    -e POSTGRES_PASSWORD=${PGPASSWORD} \
    -v /etc/passwd:/etc/passwd:ro \
    -v /etc/group:/etc/group:ro \
    -v ${PGHOME}/pgdata:/var/lib/postgresql/data \
    -v ${PGHOME}/initdb:/docker-entrypoint-initdb.d \
    ${PGIMAGE} -i

echo "$(date +%Y-%m-%d_%T.%N): done ${BASH_SOURCE[0]}"
