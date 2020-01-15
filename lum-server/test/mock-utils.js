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

/**
 * assert the value is a proper uuid version 4
 * @param  {string} value
 * @param  {string} fieldName
 * @param  {string} message explanation of the value
 */
function assertUuid(value, fieldName, message) {
    assert.match(value, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
        `${message}: expected ${fieldName}(${value}) to be uuid`);
}

/**
 * assert the value is a stringified DateTime
 * @param  {string} value
 * @param  {string} fieldName
 * @param  {string} message explanation of the value
 */
function assertDateTime(value, fieldName, message) {
    assert.isNotNaN(new Date(value).getTime(),
        `${message}: expected ${fieldName}(${value}) to be a stringified DateTime`);
}

/**
 * assert that two values are equal or special cases to verify the format or to ignore
 * @param  {} value
 * @param  {} expected
 * @param  {string} key name of the field or index under comparison
 * @param  {string} message explanation of the values
 */
function assertEqual(value, expected, key, message) {
    if (expected == null) {
        return assert.isNull(value, `${message}: unexpected ${key}: ${value} instead of ${expected}`);
    }
    if (expected === '__type__uuid__')      {return assertUuid(value, key, message);}
    if (expected === '__type__dateTime__')  {return assertDateTime(value, key, message);}
    if (expected === '__type__ignore__')    {return;}
    if (expected === '__env__NODE_VERSION') {return process.env.NODE_VERSION;}
    if (typeof expected === 'object')       {return module.exports.assertDeepEqual(value, expected, message);}
    assert.equal(value, expected, `${message}: unexpected ${key}: ${value} instead of ${expected}`);
}

module.exports = {
    /**
     * deep compare value versus expected
     * @param  {} value
     * @param  {} expected
     * @param  {string} message explanation of the values
     */
    assertDeepEqual(value, expected, message) {
        if (expected == null) {return;}
        if (typeof value !== typeof expected) {
            assert.fail(value, expected,
                `${message}: unmatched typeof(${typeof value}) for ${value} versus expected typeof(${typeof expected}) for ${expected}`);
        }
        if (Array.isArray(value)) {
            assert.equal(value.length, expected.length, `${message}: unexpected length(value.length) of array ${value}`);
            for (let idx = 0; idx < value.length; ++idx) {
                assertEqual(value[idx], expected[idx], `[${idx}]`, message);
            }
            return;
        }
        for (const key in expected) {
            assertEqual(value[key], expected[key], key, message);
        }
    }
};

