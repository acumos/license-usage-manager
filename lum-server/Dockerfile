# ===================================================================
# Copyright (c) 2019 AT&T Intellectual Property. All rights reserved.
# Modifications Copyright (C) 2019 Nordix Foundation.
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

# The instructions for the first stage
FROM node:10.16.3-alpine as build-stage

ARG BUILD_DEVELOPMENT
# if --build-arg BUILD_DEVELOPMENT=1, set NODE_ENV to 'development' or set to null otherwise.
ENV NODE_ENV=${BUILD_DEVELOPMENT:+development}
# if NODE_ENV is null, set it to 'production' (or leave as is otherwise).
ENV NODE_ENV=${NODE_ENV:-production}

WORKDIR /work/
COPY package*.json ./
COPY ./lum-server-api/   ./lum-server-api/
COPY  ./lum-server.js lum-server.js
COPY ./src src
COPY ./*.txt    .
COPY ./etc/     ./etc/
COPY ./lum-server-api/   ./lum-server-api/
RUN npm install --quiet

RUN if [ "$BUILD_DEVELOPMENT" == "1" ]; \
    then echo 'installing nodemon' && npm install nodemon ; \
    fi 

FROM node:10.16.3-alpine as lint-stage

## ES lint 
WORKDIR /js-lint-work/
COPY .eslintrc.js ./.eslintrc.js
COPY --from=build-stage /work/src src
RUN npm install eslint@^6.5.0  --no-save
RUN npm install eslint-config-recommended@^4.0.0  --no-save
RUN ls -la 
RUN node_modules/.bin/eslint .

## OAS linting
WORKDIR /oas-work/
COPY --from=build-stage /work/ .
RUN npm install speccy
RUN npm run lint-spec

# The instructions for last runtime stage
FROM node:10.16.3-alpine

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
    then echo 'removing npm' &&  npm remove -g npm; \
    fi 

RUN addgroup ${APPUSER} \
 && adduser -S -h ${APPDIR} -G ${APPUSER} ${APPUSER} \
 && chown -R ${APPUSER}:${APPUSER} ${APPDIR}

USER ${APPUSER}

EXPOSE ${APPPORT}

CMD ["/usr/local/bin/node", "lum-server.js"]