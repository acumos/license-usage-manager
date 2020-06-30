# ========================================================================
# Copyright (c) 2019-2020 AT&T Intellectual Property. All rights reserved.
# Modifications Copyright (C) 2019 Nordix Foundation.
# ========================================================================
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
# ============LICENSE_END=================================================
# Dockerfile for lum-server

FROM node:12.18.1-alpine

ARG SVRVERSION
ENV NODE_ENV=production
ENV APPPORT 2080
ENV APPUSER lum
ENV APPDIR /opt/app/${APPUSER}

WORKDIR ${APPDIR}
COPY package*.json       ./
COPY ./*.txt             ./
COPY ./lum-server.js     ./lum-server.js
COPY ./src/              ./src/
COPY ./etc/              ./etc/
COPY ./lum-server-api/   ./lum-server-api/
RUN sed -i package.json -e "/^  \"version\":/s/:.*/: \"${SVRVERSION%-*}\",/" \
 && sed -i package-lock.json -e "/^  \"version\":/s/:.*/: \"${SVRVERSION%-*}\",/" \
 && mkdir -p logs \
 && mkdir -p log-acu \
 && ls -la && echo 'npm install --production' && npm install --production --quiet \
 && ls -la && npm ls --depth 0 && echo "$(ls -l node_modules | grep -c ^d) folders in node_modules" \
 && echo 'removing npm' && npm remove -g npm

RUN addgroup ${APPUSER} \
 && adduser -S -h ${APPDIR} -G ${APPUSER} ${APPUSER} \
 && chown -R ${APPUSER}:${APPUSER} ${APPDIR}

USER ${APPUSER}

EXPOSE ${APPPORT}

CMD ["/usr/local/bin/node", "lum-server.js"]
