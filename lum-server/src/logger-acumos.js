// ================================================================================
// Copyright (c) 2020 AT&T Intellectual Property. All rights reserved.
// ================================================================================
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
// ============LICENSE_END=========================================================

module.exports = {
    /**
     * status of the request processing
     * @enum {string} entry: 'ENTRY', inprogress: 'INPROGRESS', exit: 'EXIT'
     */
    reqStatuses: {entry: 'ENTRY', inprogress: 'INPROGRESS', exit: 'EXIT'},
    /**
     * write a message to log in acumos logger
     * @param  {} res
     * @param  {Enumerator} reqStatus entry: 'ENTRY', inprogress: 'INPROGRESS', exit: 'EXIT'
     * @param  {string} exeStep execution step to show up as InvocationID
     * @param  {} message to put into Message field
     * @param  {boolean} gotError
     */
    logForAcumos(res, reqStatus, exeStep, message, gotError) {
        if (reqStatus != module.exports.reqStatuses.entry && !res.locals.logForAcumos) {return;}
        const exit = (reqStatus === module.exports.reqStatuses.exit);

        const logForAcumos = {
            LogTimestamp: new Date().toISOString(),
            RequestID: res.locals.requestId,
            InvocationID: exeStep,
            InstanceID: lumServer.healthcheck.serverRunInstanceId,
            Thread: 'main',
            ServiceName: `${lumServer.healthcheck.serverName}${res.locals.requestHttp.path}`,
            Partnername: res.locals.requestHttp.userAgent || res.locals.params.userId,
            StatusCode: ((gotError && 'ERROR') || (exit && 'COMPLETE') || 'INPROGRESS'),
            ResponseCode: (exit && res.statusCode) || null,
            ResponseDescription: (exit && res.statusMessage) || null,
            Level: lumServer.config.logging.logLevel.toUpperCase(),
            Severity: ((gotError && 'ERROR') || 'INFO'),
            ServerFQDN: res.locals.requestHttp.serverFQDN,
            ClientIPAddress: res.locals.requestHttp.clientIPAddress,
            TargetEntity: null,
            TargetServiceName: null,
            User: res.locals.params.userId,
            Logger: __filename,
            Mdc: null,
            Message: message,
            Marker: reqStatus
        };
        lumServer.logForAcumos(logForAcumos);
    },
    /**
     * start logging to log-acu/lum-server/lum-server.log
     */
    startLogForAcumos(req, res, next) {
        module.exports.logForAcumos(res, module.exports.reqStatuses.entry,
            `${res.locals.requestHttp.method} ${res.locals.requestHttp.path}`, res.locals.reqBody);
        res.locals.logForAcumos = true;
        next();
    }
};

