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
    /**
     * SqlParams - collection of field names+values with the offsetIdx
     * to simplify building SQL statement
     * @param  {} offsetIdx
     */
    constructor(offsetIdx) {
        this.offsetIdx = offsetIdx || 0;
        this._names    = [];
        this.values    = [];
        this._keyName  = null;
    }
    /**
     * base method to add any parameter that is defined
     * @param  {} paramName
     * @param  {} paramValue - null is ok
     */
    addParam(paramName, paramValue) {
        if (typeof paramValue !== 'undefined') {
            this._names.push(paramName);
            this.values.push(paramValue);
        }
    }
    /**
     * to pass array to json field in pg - need to stringify
     * @param  {} paramName - name of the field
     * @param  {} paramValue - value of the field
     */
    addParamJson(paramName, paramValue) {
        if (paramValue === null) {
            this.addParam(paramName, paramValue);
        } else if (typeof paramValue !== 'undefined') {
            this.addParam(paramName, JSON.stringify(paramValue));
        }
    }
    /**
     * pass the names of params - used for select
     * @param  {} params
     */
    addParams(params) {
        for (const paramName in params) {
            this.addParam(paramName, true);
        }
    }
    /**
     * passing the value from body when the param name is in params
     * @param  {} params
     * @param  {} body
     */
    addParamsFromBody(params, body) {
        for (const paramName in params) {
            this.addParam(paramName, body[paramName]);
        }
    }
    /**
     * when have single key, but many values
     * @param  {} keyName
     * @param  {} keyValues
     */
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
    /**
     * count of values
     */
    get length() {
        return this.values.length;
    }
    /**
     * chaining the sqlParams of different nature, but passing the values in a combined array
     */
    get nextOffsetIdx() {
        return this.offsetIdx + this.values.length;
    }
    /**
     * format the list of field names for select clause
     * @param  {} prefix - table alias
     */
    getReturningFields(prefix) {
        prefix = (prefix && (prefix+'.')) || '';
        return Array.from(this._names, name => `${prefix}"${name}"`).join();
    }
    /**
     * wrapper to prepend the comma ',' before the list of values or names if needed
     * @param  {} sqlClause
     */
    preComma(sqlClause) {
        return ((this.offsetIdx && this.values.length && ', ') || '') + sqlClause;
    }
    /**
     * comma separated list of names
     */
    get names() {
        return Array.from(this._names, name => `"${name}"`).join();
    }
    /**
     * comma separated list of names with prepended comma if needed
     */
    get fields() {
        return this.preComma(this.names);
    }
    /**
     * key name when only a single key is param
     */
    get keyName() {
        return `"${this._keyName}"`;
    }
    /**
     * list of indexed params for the key values
     */
    get idxKeyValues() {
        return Array.from(this.values.keys(), idx => `($${idx + 1 + this.offsetIdx})`).join();
    }
    /**
     * list of indexed params for the values
     */
    get idxValues() {
        return this.preComma(Array.from(this.values.keys(), idx => `($${idx + 1 + this.offsetIdx})`).join());
    }
    /**
     * list of SET items in UPDATE SQL statement
     */
    get updates() {
        return this.preComma(Array.from(this.values.keys(), idx => `"${this._names[idx]}" = ($${idx + 1 + this.offsetIdx})`).join());
    }
    /**
     * list of ANDed WHERE items in SQL statement
     */
    get where() {
        return Array.from(this.values.keys(), idx => `"${this._names[idx]}" = ($${idx + 1 + this.offsetIdx})`).join(' AND ');
    }
    /**
     * list of ANDed WHERE items in SQL statement with the table alias prefix
     * @param  {} prefix
     */
    getWhere(prefix) {
        prefix = (prefix && (prefix+'.')) || '';
        return Array.from(this.values.keys(), idx => `${prefix}"${this._names[idx]}" = ($${idx + 1 + this.offsetIdx})`).join(' AND ');
    }
    /**
     * list of ORed WHERE items in SQL statement with the table alias prefix
     * used for checking whether any field is changed
     * @param  {} prefix
     */
    getWhereDistinct(prefix) {
        prefix = (prefix && (prefix+'.')) || '';
        return Array.from(this.values.keys(), idx => `${prefix}"${this._names[idx]}" IS DISTINCT FROM ($${idx + 1 + this.offsetIdx})`).join(' OR ');
    }
};
