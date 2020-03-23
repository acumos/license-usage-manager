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
/**
 * @file class for generating parts of Sql stamenents
 */
"use strict";

module.exports = class SqlParams {
    /**
     * SqlParams - collection of field names+values or key(s) with the offsetIdx
     * to simplify building SQL statement
     * @param  {SqlParams} [prevSqlParams] previous SqlParams object in chain
     */
    constructor(prevSqlParams) {
        this.offsetIdx = (prevSqlParams && prevSqlParams.nextOffsetIdx) || 0;
        this._names    = [];
        this.values    = [];
        this._keyName  = null;

        this._next     = null;
        if (prevSqlParams) {
            prevSqlParams._next = this;
        }
    }
    /**
     * base method to add any field that has the value defined
     * @param  {string} fieldName name of the field
     * @param  {} fieldValue value of the field, null is ok
     */
    addField(fieldName, fieldValue) {
        if (typeof fieldValue !== 'undefined') {
            this._names.push(fieldName);
            this.values.push(fieldValue);
        }
    }
    /**
     * to pass array to json field in pg - need to stringify
     * @param  {string} fieldName name of the field
     * @param  {} fieldValue value of the field
     */
    addFieldJson(fieldName, fieldValue) {
        if (fieldValue === null) {
            this.addField(fieldName, fieldValue);
        } else if (typeof fieldValue !== 'undefined') {
            this.addField(fieldName, JSON.stringify(fieldValue));
        }
    }
    /**
     * pass the names of fields - used for select
     * @param  {Object} fieldNames dict with field names as keys
     */
    addFields(fieldNames) {
        for (const fieldName in fieldNames) {
            this.addField(fieldName, true);
        }
    }
    /**
     * passing the value from body when the param name is in fieldNames
     * @param  {Object} fieldNames dict with field names as keys
     * @param  {Object} body dict with field values per the field names from fieldNames
     */
    addFieldsFromBody(fieldNames, body) {
        for (const fieldName in fieldNames) {
            this.addField(fieldName, body[fieldName]);
        }
    }
    /**
     * when have single key, but many values
     * @param  {string} keyName
     * @param  {string[]|Object} keyValues either a list of values or dictionary with value in the key
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
     * chaining the SqlParams of different nature, but passing the values in a combined array
     * @returns {number} offsetIdx + values.length
     */
    get nextOffsetIdx() {
        return this.offsetIdx + this.values.length;
    }
    /**
     * format the list of field names for select clause
     * @param  {string} [prefix] table alias
     * @returns {string} <prefix>."<name>", ...
     */
    getReturningFields(prefix) {
        prefix = (prefix && (prefix+'.')) || '';
        return Array.from(this._names, name => `${prefix}"${name}"`).join();
    }
    /**
     * wrapper to prepend the comma ',' before the list of values or names if needed
     * @param  {string} sqlClause
     * @returns {string} either ', ' + sqlClause or sqlClause
     */
    preComma(sqlClause) {
        return ((this.offsetIdx && this.values.length && ', ') || '') + sqlClause;
    }
    /**
     * comma separated list of names
     * @returns {string} "<name>", ...
     */
    get names() {
        return Array.from(this._names, name => `"${name}"`).join();
    }
    /**
     * comma separated list of names with prepended comma if needed
     * @returns {string} either ', "<name>", ...' or '"<name>", ...'
     */
    get fields() {
        return this.preComma(this.names);
    }
    /**
     * key name when only a single key is param
     * @returns {string} "<keyName>"
     */
    get keyName() {
        return `"${this._keyName}"`;
    }
    /**
     * list of indexed params for the key values
     * @returns {string} "($1),($2),($3),($4),..."
     */
    get idxKeyValues() {
        return Array.from(this.values.keys(), idx => `($${idx + 1 + this.offsetIdx})`).join();
    }
    /**
     * indexed param for the first value
     * @returns {string} "($1)"
     */
    get idxFirstValue() {
        return `($${1 + this.offsetIdx})`;
    }
    /**
     * list of indexed params for the values
     * @returns {string} either ', ($2),($3),($4),($5), ...' or "($1),($2),($3),($4), ..."
     */
    get idxValues() {
        return this.preComma(this.idxKeyValues);
    }
    /**
     * list of SET items in UPDATE SQL statement
     * @returns {string} either ', "<name>" = ($2), ...' or '"<name>" = ($1), ...'
     */
    get updates() {
        return this.preComma(Array.from(this.values.keys(), idx => `"${this._names[idx]}" = ($${idx + 1 + this.offsetIdx})`).join());
    }
    /**
     * list of ANDed WHERE items in SQL statement
     * @returns {string} "<name>" = ($1) AND ...'
     */
    get where() {
        return Array.from(this.values.keys(), idx => `"${this._names[idx]}" = ($${idx + 1 + this.offsetIdx})`).join(' AND ');
    }
    /**
     * list of ANDed WHERE items in SQL statement with the table alias prefix
     * @param  {string} [prefix]
     * @returns {string} <prefix>."<name>" = ($1) AND ...'
     */
    getWhere(prefix) {
        prefix = (prefix && (prefix+'.')) || '';
        return Array.from(this.values.keys(), idx => `${prefix}"${this._names[idx]}" = ($${idx + 1 + this.offsetIdx})`).join(' AND ');
    }
    /**
     * list of ORed WHERE items in SQL statement with the table alias prefix
     * used for checking whether any field is changed
     * @param  {string} [prefix]
     * @returns {string} <prefix>."<name>" IS DISTINCT FROM ($1) OR ...'
     */
    getWhereDistinct(prefix) {
        prefix = (prefix && (prefix+'.')) || '';
        return Array.from(this.values.keys(), idx => `${prefix}"${this._names[idx]}" IS DISTINCT FROM ($${idx + 1 + this.offsetIdx})`).join(' OR ');
    }
    /**
     * recurisively collect all values
     * @param  {} [allValues]
     * @returns {Object[]} concat of all values in chain of SqlParams
     */
    getAllValues(allValues) {
        if (allValues) {
            if (this.values.length) {allValues.push(this.values);}
            if (this._next) {this._next.getAllValues(allValues);}
            return allValues;
        }
        if (!this._next) {return this.values;}
        return this.values.concat(...this._next.getAllValues([]));
    }
};
