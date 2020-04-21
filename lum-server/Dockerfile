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

# The instructions for the first stage
FROM node:12.16.1-alpine as build-stage

ARG BUILD_DEVELOPMENT
ARG SVRVERSION

# if --build-arg BUILD_DEVELOPMENT=1, set NODE_ENV to 'development' or set to null otherwise.
ENV NODE_ENV=${BUILD_DEVELOPMENT:+development}
# if NODE_ENV is null, set it to 'production' (or leave as is otherwise).
ENV NODE_ENV=${NODE_ENV:-production}

WORKDIR /work/
COPY package*.json       ./
COPY ./*.txt             .
COPY ./lum-server.js     ./lum-server.js
COPY ./src/              ./src/
COPY ./lum-server-api/   ./lum-server-api/
COPY ./etc/              ./etc/
RUN sed -i package.json -e "/^  \"version\":/s/:.*/: \"${SVRVERSION%-*}\",/" \
 && sed -i package-lock.json -e "/^  \"version\":/s/:.*/: \"${SVRVERSION%-*}\",/" \
 && ls -la && npm install --production --quiet \
 && ls -la && npm ls --depth 0 && echo "$(ls -l node_modules | grep -c ^d) folders in node_modules"

RUN if [ "$BUILD_DEVELOPMENT" == "1" ]; \
    then echo 'installing nodemon' && npm install nodemon ; \
    fi

# The instructions for last runtime stage
FROM node:12.16.1-alpine

ARG BUILD_DEVELOPMENT
# if --build-arg BUILD_DEVELOPMENT=1, set NODE_ENV to 'development' or set to null otherwise.
ENV NODE_ENV=${BUILD_DEVELOPMENT:+development}
# if NODE_ENV is null, set it to 'production' (or leave as is otherwise).
ENV NODE_ENV=${NODE_ENV:-production}

ENV INSROOT /opt/app
ENV APPPORT 2080
ENV APPUSER lum
ENV APPDIR ${INSROOT}/${APPUSER}

WORKDIR ${APPDIR}
COPY --from=build-stage /work/ .

RUN if [ "$NODE_ENV" == "production" ]; \
    then ls -la && npm ls --depth 0 && echo "$(ls -l node_modules | grep -c ^d) folders in node_modules" \
      && echo 'removing npm' && npm remove -g npm; \
    fi

RUN addgroup ${APPUSER} \
 && adduser -S -h ${APPDIR} -G ${APPUSER} ${APPUSER} \
 && chown -R ${APPUSER}:${APPUSER} ${APPDIR}

USER ${APPUSER}

EXPOSE ${APPPORT}

CMD ["/usr/local/bin/node", "lum-server.js"]
