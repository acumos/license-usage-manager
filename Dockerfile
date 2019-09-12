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
# Dockerfile for lum-server

FROM node:10.16.3-alpine

ENV SRVDIR lum-server
ENV APIDIR lum-server-api

ENV INSROOT /opt/app
ENV APPPORT 2080
ENV APPUSER lum
ENV USRDIR ${INSROOT}/${APPUSER}
ENV APPDIR ${USRDIR}/${SRVDIR}
ENV LOGDIR ${USRDIR}/logs

COPY ${SRVDIR}/*.js     ${APPDIR}/
COPY ${SRVDIR}/*.json   ${APPDIR}/
COPY ${SRVDIR}/*.txt    ${APPDIR}/
COPY ${SRVDIR}/etc/     ${APPDIR}/etc/
COPY ${SRVDIR}/src/     ${APPDIR}/src/
COPY ${APIDIR}/         ${APPDIR}/${APIDIR}/

WORKDIR ${APPDIR}


RUN npm install \
 && npm run lint \
 && npm prune --production \
 && npm remove -g npm

RUN mkdir -p ${LOGDIR} \
 && addgroup ${APPUSER} \
 && adduser -S -h ${USRDIR} -G ${APPUSER} ${APPUSER} \
 && chown -R ${APPUSER}:${APPUSER} ${USRDIR} \
 && ls -lA ${APPDIR}/*.js* ${APPDIR}/*.txt \
 && ls -lAR ${APPDIR}/etc/ ${APPDIR}/${APIDIR}/ ${APPDIR}/src/ \
 && pwd

USER ${APPUSER}

EXPOSE ${APPPORT}

CMD ["/usr/local/bin/node", "lum-server.js"]
