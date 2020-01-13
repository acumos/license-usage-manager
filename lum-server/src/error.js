// ================================================================================
// Copyright (c) 2019-2020 AT&T Intellectual Property. All rights reserved.
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
     * InvalidDataError used to idicate that the server received invalid data from client.
     * Suggested http status = 400
     * @example
     * try {throw new InvalidDataError("missing uid on permission or prohibition");}
     * catch (e) {console.log(e, e instanceof InvalidDataError);}
     * @param  {} error passed to Error constructor
     */
    InvalidDataError : class InvalidDataError extends Error {
        constructor(error) {
            super();
            this.code = "LUM:InvalidDataError";
            if (typeof error === 'string') {this.message = error;}
            else {
                if (!Array.isArray(error)) {error = [error];}
                if (error.length === 1) {
                    this.message = "InvalidDataError";
                } else {
                    this.message = "multiple InvalidDataErrors";
                }
                this.items = error;
            }
        }
    },
    /**
     * append the error to the collection of errors
     * @param  {Object[]} errors collection of errors
     * @param  {string} errorMessage error message
     * @param  {string} [erroredObjectName] name of the erroredObject
     * @param  {} [erroredObject] optional object the error is reported about
     */
    addError(errors, errorMessage, erroredObjectName, erroredObject) {
        if (erroredObjectName == null) {
            errors.push({error: errorMessage});
        } else {
            errors.push({error: errorMessage, [erroredObjectName]: erroredObject});
        }
    }
};
