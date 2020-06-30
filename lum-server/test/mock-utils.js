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
/**
 * @file utils for testing
 */
"use strict";
const assert = require('chai').assert;

const serverVersion = require("../package.json").version;
const reUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/**
 * assert the value is a proper uuid version 4
 * @param  {string} value
 * @param  {string} fieldName
 * @param  {string} message explanation of the value
 */
function assertUuid(value, fieldName, message) {
    assert.match(value, reUuid, `expected ${fieldName}(${value}) to be uuid: ${message}`);
}

/**
 * assert the value is a stringified DateTime
 * @param  {string} value
 * @param  {string} fieldName
 * @param  {string} message explanation of the value
 */
function assertDateTime(value, fieldName, message) {
    assert.isNotNaN(new Date(value).getTime(),
        `expected ${fieldName}(${value}) to be a stringified DateTime: ${message}`);
}

/**
 * assert that two values are equal or special cases to verify the format or to ignore
 * @param  {} value
 * @param  {} expected
 * @param  {string} key name of the field or index under comparison
 * @param  {string} message explanation of the values
 * @param  {[string]} breadcrumbs chain of key names and indexes
 */
function assertEqual(value, expected, key, message, breadcrumbs) {
    breadcrumbs = Array.from(breadcrumbs || []);
    breadcrumbs.push(key);
    key = strBreadcrumbs(breadcrumbs);
    if (expected == null) {
        return assert.isNull(value, `unexpected ${key}(${value}) instead of ${expected}: ${message}`);
    }
    if (expected === '__type__uuid__')      {return assertUuid(value, key, message);}
    if (expected === '__type__dateTime__')  {return assertDateTime(value, key, message);}
    if (expected === '__type__ignore__')    {return;}
    if (expected === '__env__NODE_VERSION') {expected = process.env.NODE_VERSION;}
    if (expected === '__srvr__version__')   {expected = serverVersion;}
    if (typeof expected === 'object')       {return module.exports.assertDeepEqual(value, expected, message, breadcrumbs);}
    assert.equal(value, expected, `unexpected value of ${key}(${value}): ${message}`);
}

/**
 * convert the array of breadcrumbs into a string
 * @param  {[string]} breadcrumbs chain of key names and indexes
 * @returns {string} 'a->[3]->b'
 */
function strBreadcrumbs(breadcrumbs) {
    return (Array.isArray(breadcrumbs) && breadcrumbs.join('->')) || '';
}

module.exports = {
    /**
     * deep compare value versus expected
     * @param  {} value
     * @param  {} expected
     * @param  {string} message explanation of the values
     * @param  {string|[string]} [breadcrumbs] chain of key names and indexes
     */
    assertDeepEqual(value, expected, message, breadcrumbs) {
        if (expected == null) {return;}
        if (typeof value !== typeof expected) {
            assert.fail(value, expected,
                `unmatched typeof(${typeof value}) for ${strBreadcrumbs(breadcrumbs)}(${value}) versus expected typeof(${typeof expected}) for ${expected}: ${message}`);
        }
        if (Array.isArray(value)) {
            assert.equal(value.length, expected.length,
                `unexpected length(${value.length}) of array ${strBreadcrumbs(breadcrumbs)}(${
                    module.exports.shortenString(JSON.stringify(value))}): ${message}`);
            for (let idx = 0; idx < value.length; ++idx) {
                assertEqual(value[idx], expected[idx], `[${idx}]`, message, breadcrumbs);
            }
            return;
        }
        for (const key in expected) {
            assertEqual(value[key], expected[key], key, message, breadcrumbs);
        }
    },
    /**
     * when the text is too long, returns the
     * @param  {string} txt
     * @param  {number} [maxLength] defaults to 100
     * @returns {string} shorten txt if longer than maxLength
     */
    shortenString(txt, maxLength=100) {
        if (txt && txt.length > maxLength) {return `${txt.substr(0,maxLength)}...`;}
        return txt;
    }
};

