// ================================================================================
// Copyright (c) 2019 AT&T Intellectual Property. All rights reserved.
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

"use strict";

module.exports = class SqlParams {
    constructor(offsetIdx) {
        this.offsetIdx = offsetIdx || 0;
        this._names    = [];
        this.values    = [];
        this._keyName  = null;
    }
    addParam(paramName, paramValue) {
        if (typeof paramValue !== 'undefined') {
            this._names.push(paramName);
            this.values.push(paramValue);
        }
    }
    addParams(params) {
        for (const paramName in params) {
            this.addParam(paramName, true);
        }
    }
    addParamsFromBody(params, body) {
        for (const paramName in params) {
            this.addParam(paramName, body[paramName]);
        }
    }
    setKeyValues(keyName, keyValues) {
        this._keyName = keyName;
        this.values  = [];
        if (Array.isArray(keyValues)) {
            for (const keyValue of keyValues) {
                if (typeof keyValue !== 'undefined') {
                    this.values.push(keyValue);
                }
            }
            return;
        }
        for (const keyValue in keyValues) {
            if (typeof keyValue !== 'undefined') {
                this.values.push(keyValue);
            }
        }
    }
    get length() {
        return this.values.length;
    }
    get nextOffsetIdx() {
        return this.offsetIdx + this.values.length;
    }
    getReturningFields(prefix) {
        prefix = (prefix && (prefix+'.')) || '';
        return Array.from(this._names, name => `${prefix}"${name}"`).join();
    }
    preComma(sqlClause) {
        return ((this.offsetIdx && this.values.length && ', ') || '') + sqlClause;
    }
    get names() {
        return Array.from(this._names, name => `"${name}"`).join();
    }
    get fields() {
        return this.preComma(this.names);
    }
    get keyName() {
        return `"${this._keyName}"`;
    }
    get idxKeyValues() {
        return Array.from(this.values.keys(), idx => `($${idx + 1 + this.offsetIdx})`).join();
    }
    get idxValues() {
        return this.preComma(Array.from(this.values.keys(), idx => `($${idx + 1 + this.offsetIdx})`).join());
    }
    get updates() {
        return this.preComma(Array.from(this.values.keys(), idx => `"${this._names[idx]}" = ($${idx + 1 + this.offsetIdx})`).join());
    }
    get where() {
        return Array.from(this.values.keys(), idx => `"${this._names[idx]}" = ($${idx + 1 + this.offsetIdx})`).join(' AND ');
    }
    getWhere(prefix) {
        prefix = (prefix && (prefix+'.')) || '';
        return Array.from(this.values.keys(), idx => `${prefix}"${this._names[idx]}" = ($${idx + 1 + this.offsetIdx})`).join(' AND ');
    }
    getWhereDistinct(prefix) {
        prefix = (prefix && (prefix+'.')) || '';
        return Array.from(this.values.keys(), idx => `${prefix}"${this._names[idx]}" IS DISTINCT FROM ($${idx + 1 + this.offsetIdx})`).join(' OR ');
    }
};
