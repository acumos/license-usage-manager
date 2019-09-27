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
/**
 * @fileoverview ODRL based objects
 *
 * @see {@link https://www.w3.org/TR/odrl-model} for info on ODRL
 * @see {@link https://wiki.acumos.org/pages/viewpage.action?pageId=20547102}  for info on ODRL in LUM
 * @see {@link https://wiki.acumos.org/display/LM/ODRL+based+License-Usage-Manager+%28LUM%29+architecture}  for info on ODRL in LUM
 */

// agreement: {
//      "uid": <IRI>,
//      "@context": {}, - ignored
//      "@type":" Agreement",
//      "assigner": {}, - ignored
//      "assignee": {
//          "uid": "http://companyb.com/team",
//          "refinement": [
//              {
//                  "leftOperand": "lum:countUniqueUsers",
//                  "operator": "lteq",
//                  "rightOperand": {
//                      "@value": "20",
//                      "@type": "xsd:integer"
//                  }
//              }
//          ]
//      },
//      "target": {
//          "refinement": [
//              {
//                  "leftOperand": "lum:swProductName",
//                  "operator": "lum:in",
//                  "rightOperand": ["face-detect-model", "optimize-model"]
//              },
//              {
//                  "leftOperand": "lum:swTagId",
//                  "operator": "lum:in",
//                  "rightOperand": ["d303fff1-6e20-4f0b-bb0d-6d3f2d4207f8"]
//              }
//          ]
//      },
//      "permission": [{
//          "uid": <IRI>,
//          "target": {
//              "refinement": [
//                  {
//                      "leftOperand": "lum:swPersistentId",
//                      "operator": "lum:in",
//                      "rightOperand": [
//                          "b0ca3e90-a38e-474e-8479-f00661699c2d",
//                          "30053d79-be2c-4f76-9a4f-d45321a14fe2"
//                      ]
//                  }
//              ]
//          },
//          "action": [
//              {
//                  "@type": "Action",
//                  "@value": "acumos:deploy"
//              },
//              {
//                  "@type": "Action",
//                  "@value": "acumos:download"
//              }
//          ],
//          "constraint": [
//              {
//                  "@type": "Constraint",
//                  "leftOperand": "count",
//                  "operator": "lt",
//                  "rightOperand": {
//                      "@value": "10",
//                      "@type": "xsd:integer"
//                  }
//              }
//          ]
//      }]
// }

"use strict";

const utils = require('../utils');
const {InvalidDataError} = require('../error');


const OPERATORS = {lt:'lt', lteq:'lteq', eq:'eq', gt:'gt', gteq:'gteq', lumIn:'lum:in'};
const CONSUMED_CONSTRAINTS = {
    merged:'merged', overridden:'overridden', conflicted:'conflicted', errored:'errored', ignored:'ignored', consumed:'consumed'};

const FIELDS = {value:'@value', type: '@type'};
const TYPES = {"integer": "integer", "string": "string"};
const LEFT_OPERANDS = {
    "count": {dataType: "integer", usageConstraint: true},
    "date":  {dataType: "date"},
    "lum:countUniqueUsers": {dataType: "integer"}
};

/**
 * list of similar operators
 *
 * @example 'lt' -> ['lt', 'lteq']
 *
 * @param  {string} operator
 * @returns {string[]} similar operators
 */
function getSimilarOperators(operator) {
    if (!operator) {return [operator];}
    const lt = [OPERATORS.lt, OPERATORS.lteq];  if (lt.includes(operator)) {return lt;}
    const gt = [OPERATORS.gt, OPERATORS.gteq];  if (gt.includes(operator)) {return gt;}
    return [operator];
}
/**
 * compare each item in lhv versus each item in rhv per comparison operator
 *
 * @example
 * compare('lt', 1, 2) -> true
 * compare('lt', "1", 2) -> true
 * compare('lt', "10", "9") -> true
 *
 * @param  {string} operator
 * @param  {string|number} lhv left hand value
 * @param  {string|number} rhv right hand value
 * @returns {boolean} whether comparison succeeded - whether the lhv is better fit than rhv
 */
function compareTwoValues(operator, lhv, rhv) {
    if (lhv == null || rhv == null)     {return false;}

    if (operator === OPERATORS.lt)      {return lhv <  rhv;}
    if (operator === OPERATORS.lteq)    {return lhv <= rhv;}
    if (operator === OPERATORS.gt)      {return lhv >  rhv;}
    if (operator === OPERATORS.gteq)    {return lhv >= rhv;}
    if (operator === OPERATORS.eq)      {return lhv == rhv;}
}
/**
 * convert the action value into an array of strings
 *
 * for example
 *
 * "play" -> ```["play"]```
 *
 * ["play", "stream"] -> ```["play", "stream"]```
 *
 * ```{"@type": "Action","@value": "acumos:deploy"}``` -> ```["acumos:deploy"]```
 *
 * ```[{"@type": "Action","@value": "acumos:deploy"}, {"@type": "Action","@value": "acumos:download"}]``` ->
 * ```["acumos:deploy", "acumos:download"]```
 *
 * @param  {} action
 * @returns {string[]} array of groomed action values
 */
function groomAction(action) {
    if (!action) {return [];}
    if (!Array.isArray(action)) {action = [action];}
    return action.map(item => {
        if (typeof item === 'string')           {return item;}
        if (item && typeof item === 'object')   {return item[FIELDS.value];}
    }).filter(nonEmptyItem => !!nonEmptyItem);
}
/**
 * push each constraint into consumedConstraints with ```[status]:true```
 * @param  {Object[]} consumedConstraints
 * @param  {string} status
 * @param  {Object} constraints
 */
function consumeConstraint(consumedConstraints, status, ...constraints) {
    for (const constraint of constraints) {
        consumedConstraints.push(Object.assign({[status]:true}, constraint));
    }
}
/**
 * groom the rightOperand, dataType, unit in constraint to the form
 * ```rightOperand: [<typed-value>], dataType: <type-of-value>, unit: <unit>```
 *
 * for example
 *
 * ```operator: "lum:in", rightOperand: "image-processing"``` ->
 * ```rightOperand: ["image-processing"], dataType: "string"```
 *
 * ```operator: "lum:in", rightOperand: ["face-detection"]``` ->
 * ```rightOperand: ["face-detection"], dataType: "string"```
 *
 * ```rightOperand: {"@value": "20", "@type": "xsd:integer"}``` ->
 * ```rightOperand: 20, dataType: "integer"```
 *
 * ```rightOperand: {"@value": "2019-09-16", "@type": "xsd:date"}``` ->
 * ```rightOperand: "2019-09-16", dataType: "date"}```
 *
 * @param  {} res
 * @param   {} constraint
 * @returns {} groomed copy of constraint
 */
function groomConstraint(res, constraint) {
    constraint = Object.assign({}, constraint);
    utils.logInfo(res, 'groomConstraint to groom constraint', constraint);
    constraint.dataType = (LEFT_OPERANDS[constraint.leftOperand] || {}).dataType || TYPES.string;

    if (constraint.rightOperand == null) {
        return constraint;
    }

    if (!Array.isArray(constraint.rightOperand)) {
        constraint.rightOperand = [constraint.rightOperand];
    }
    constraint.rightOperand = constraint.rightOperand.map(rop => {
        if (rop == null) {return;}
        if (typeof rop === 'string') {return rop;}
        if (typeof rop !== 'object') {return rop;}

        constraint.dataType = (rop[FIELDS.type] || '').toLowerCase().replace('xsd:', '')
                           || constraint.dataType;
        const ropValue = rop[FIELDS.value];
        if (ropValue == null) {return;}
        if (typeof ropValue !== 'string') {return JSON.stringify(ropValue);}
        return ropValue;
    }).filter(nonEmptyItem => nonEmptyItem != null);

    if (constraint.operator === OPERATORS.lumIn) {return constraint;}

    if (!constraint.rightOperand.length) {
        constraint.rightOperand = null;
        return constraint;
    }
    constraint.rightOperand = constraint.rightOperand[0];
    if (constraint.dataType === TYPES.integer) {
        constraint.rightOperand = +constraint.rightOperand;
        if (constraint.operator === OPERATORS.lt) {
            --constraint.rightOperand;
            constraint.operator = OPERATORS.lteq;
        } else if (constraint.operator === OPERATORS.gt) {
            ++constraint.rightOperand;
            constraint.operator = OPERATORS.gteq;
        }
    }
    return constraint;
}

/**
 * merge addon to the initial constraint
 *
 * @param  {} res
 * @param  {} constraint initial constraint
 * @param  {} addon constraint to add to initial constraint
 * @param  {} consumedConstraints collection of merged and conflicted constraints
 *                                that got consumed by grooming
 * @returns {boolean} whether merged addon to initial constraint
 */
function mergeTwoConstraints(res, constraint, addon, consumedConstraints) {
    if (!constraint || !addon) {return;}
    if (constraint.leftOperand !== addon.leftOperand) {return;}
    utils.logInfo(res, 'mergeTwoConstraints constraint', constraint, '<- addon', addon);

    if ([constraint.operator, addon.operator].includes(OPERATORS.lumIn)) {
        consumeConstraint(consumedConstraints, CONSUMED_CONSTRAINTS.merged, constraint, addon);
        if (constraint.operator === addon.operator) {
            constraint.rightOperand = constraint.rightOperand.filter(x => addon.rightOperand.includes(x));
        } else if (constraint.operator === OPERATORS.lumIn) {
            constraint.rightOperand = constraint.rightOperand.filter(x =>
                compareTwoValues(addon.operator, x, addon.rightOperand));
        } else {
            constraint.operator = OPERATORS.lumIn;
            constraint.dataType = addon.dataType;
            constraint.rightOperand = addon.rightOperand.filter(x =>
                compareTwoValues(constraint.operator, x, constraint.rightOperand));
        }
        utils.logInfo(res, 'merged mergeTwoConstraints constraint', constraint);
        return true;
    }

    if (constraint.operator === addon.operator) {
        if (constraint.operator === OPERATORS.eq) {
            if (!(addon.rightOperand == constraint.rightOperand)) {
                consumeConstraint(consumedConstraints, CONSUMED_CONSTRAINTS.conflicted, constraint, addon);
                constraint.rightOperand = null;
            } else {
                consumeConstraint(consumedConstraints, CONSUMED_CONSTRAINTS.ignored, addon);
            }
            utils.logInfo(res, 'merged mergeTwoConstraints constraint', constraint);
            return true;
        }
        if (compareTwoValues(constraint.operator, addon.rightOperand, constraint.rightOperand)) {
            consumeConstraint(consumedConstraints, CONSUMED_CONSTRAINTS.overridden, constraint);
            constraint.rightOperand = addon.rightOperand;
            constraint.dataType     = addon.dataType;
        } else {
            consumeConstraint(consumedConstraints, CONSUMED_CONSTRAINTS.ignored, addon);
        }
        utils.logInfo(res, 'merged mergeTwoConstraints constraint', constraint);
        return true;
    }

    // ... here when different operators...
    if (constraint.operator === OPERATORS.eq) {
        if (!compareTwoValues(addon.operator, constraint.rightOperand, addon.rightOperand)) {
            consumeConstraint(consumedConstraints, CONSUMED_CONSTRAINTS.conflicted, constraint, addon);
            constraint.rightOperand = null;
        } else {
            consumeConstraint(consumedConstraints, CONSUMED_CONSTRAINTS.ignored, addon);
        }
        utils.logInfo(res, 'merged mergeTwoConstraints constraint', constraint);
        return true;
    }
    if (addon.operator === OPERATORS.eq) {
        if (compareTwoValues(constraint.operator, addon.rightOperand, constraint.rightOperand)) {
            consumeConstraint(consumedConstraints, CONSUMED_CONSTRAINTS.overridden, constraint);
            constraint.operator     = addon.operator;
            constraint.rightOperand = addon.rightOperand;
            constraint.dataType     = addon.dataType;
        } else {
            consumeConstraint(consumedConstraints, CONSUMED_CONSTRAINTS.conflicted, constraint, addon);
            constraint.rightOperand = null;
        }
        utils.logInfo(res, 'merged mergeTwoConstraints constraint', constraint);
        return true;
    }

    const similarOperators = getSimilarOperators(constraint.operator);
    if (!similarOperators.includes(addon.operator)) {return;}
    const strongOperator = similarOperators[0];

    if (constraint.rightOperand == addon.rightOperand) {
        consumeConstraint(consumedConstraints, CONSUMED_CONSTRAINTS.merged, constraint, addon);
        constraint.operator = strongOperator;
    } else if (compareTwoValues(strongOperator, addon.rightOperand, constraint.rightOperand)) {
        consumeConstraint(consumedConstraints, CONSUMED_CONSTRAINTS.overridden, constraint);
        constraint.operator     = addon.operator;
        constraint.rightOperand = addon.rightOperand;
        constraint.dataType     = addon.dataType;
    }
    utils.logInfo(res, 'merged mergeTwoConstraints constraint', constraint);
    return true;
}

/**
 * merge all similar constraints/refinements into new collection of constraints over the baseConstraints
 *
 * does not change the source collections - makes the deep copy of everything
 *
 * @param  {} res
 * @param  {Object[]} constraints initial constraint
 * @param  {Object[]} baseConstraints constraints from agreement
 * @param  {} consumedConstraints collection of merged and conflicted constraints
 *                                that got consumed by grooming
 * @returns {Object[]} new collection of merged constraints
 */
function groomConstraints(res, constraints, baseConstraints, consumedConstraints) {
    if (!baseConstraints)                   {baseConstraints = [];}
    if (!constraints)                       {constraints = [];}
    else if (!Array.isArray(constraints))   {constraints = [constraints];}

    const mergedConstraints = [];
    for (let addon of baseConstraints.concat(constraints)) {
        addon = groomConstraint(res, addon);
        utils.logInfo(res, 'groomConstraints groomed addon', addon);

        let merged = false;
        for (const constraint of mergedConstraints) {
            merged = mergeTwoConstraints(res, constraint, addon, consumedConstraints);
            if (merged) {
                utils.logInfo(res, 'groomConstraints merged constraint', constraint);
                break;
            }
        }
        if (!merged) {
            utils.logInfo(res, 'groomConstraints added addon', addon);
            mergedConstraints.push(addon);
        }
    }
    return mergedConstraints;
}
/**
 * extract and groom refinement in the target or assignee object
 *
 * @param   {} res
 * @param   {} target target or assignee object
 * @param   {} baseTarget groomed target or assignee object from agreement if present
 * @param   {} consumedConstraints collection of merged and conflicted constraints
 *                                  that got consumed by grooming
 * @returns {} groomed copy of refinement in new target or assignee object
 */
function groomRefinement(res, target, baseTarget, consumedConstraints) {
    if (target == null && baseTarget == null) {return;}
    if (target == null || typeof target !== 'object') {
        return groomConstraints(res, null, (baseTarget || {}).refinement, consumedConstraints);
    }
    return groomConstraints(res, target.refinement, (baseTarget || {}).refinement, consumedConstraints);
}
/**
 * groom rules = array of permissions or prohibitions
 *
 * @param  {} res
 * @param  {Object[]} rules
 * @param  {string} assetUsageRuleType 'permission' or 'prohibition'
 * @param  {Object} agreement parent agreement contains keys and default target and assignee
 */
function groomRules(res, rules, assetUsageRuleType, agreement) {
    if (rules == null) {return;}
    if (!Array.isArray(rules)) {rules = [rules];}

    const groomedRules = rules.map(rule => {
        const groomedRule = {
            uid:                 rule.uid,
            assetUsageRuleType:  assetUsageRuleType,
            actions:             groomAction(rule.action),
            isPerpetual:         true,
            enableOn:            null,
            expireOn:            null,
            rightToUseActive:    true,
            closer:              null,
            closed:              null,
            closureReason:       null,
            targetRefinement:    {},
            assigneeRefinement:  {},
            assigneeMetrics:     {users: []},
            usageConstraints:    {},
            consumedConstraints: {onTarget:[], onAssignee:[], onRule:[]}
        };
        const targetRefinement = groomRefinement(res, rule.target, agreement.target,
                                                 groomedRule.consumedConstraints.onTarget);
        if (targetRefinement) {
            targetRefinement.forEach(trfn => {
                const prevConstraint = groomedRule.targetRefinement[trfn.leftOperand];
                if (prevConstraint) {
                    consumeConstraint(groomedRule.consumedConstraints.onTarget, CONSUMED_CONSTRAINTS.conflicted,
                        prevConstraint, trfn);
                    prevConstraint.rightOperand = null;
                } else {
                    groomedRule.targetRefinement[trfn.leftOperand] = trfn;
                }
            });
        }
        const assigneeRefinement = groomRefinement(res, rule.assignee, agreement.assignee,
                                                   groomedRule.consumedConstraints.onAssignee);
        if (assigneeRefinement) {
            assigneeRefinement.forEach(arfn => {
                const prevConstraint = groomedRule.assigneeRefinement[arfn.leftOperand];
                if (prevConstraint) {
                    consumeConstraint(groomedRule.consumedConstraints.onAssignee, CONSUMED_CONSTRAINTS.conflicted,
                        prevConstraint, arfn);
                    prevConstraint.rightOperand = null;
                } else {
                    groomedRule.assigneeRefinement[arfn.leftOperand] = arfn;
                }
            });
        }
        const constraints = groomConstraints(res, rule.constraint, null, groomedRule.consumedConstraints.onRule);
        if (constraints) {
            constraints.forEach(constraint => {
                if ((LEFT_OPERANDS[constraint.leftOperand] || {}).usageConstraint) {
                    const prevConstraint = groomedRule.usageConstraints[constraint.leftOperand];
                    if (prevConstraint) {
                        consumeConstraint(groomedRule.consumedConstraints.onRule, CONSUMED_CONSTRAINTS.conflicted,
                            prevConstraint, constraint);
                        prevConstraint.rightOperand = null;
                    } else {
                        groomedRule.usageConstraints[constraint.leftOperand] = constraint;
                    }
                } else if (constraint.leftOperand === "date") {
                    const rightOperand = new Date(constraint.rightOperand);
                    if (isNaN(rightOperand.getTime())) {
                        consumeConstraint(groomedRule.consumedConstraints.onRule, CONSUMED_CONSTRAINTS.errored, constraint);
                    } else {
                        if (constraint.operator === OPERATORS.gt) {
                            rightOperand.setDate(rightOperand.getDate() + 1);
                            groomedRule.enableOn = rightOperand.toISOString().substr(0,10);
                            consumeConstraint(groomedRule.consumedConstraints.onRule, CONSUMED_CONSTRAINTS.consumed, constraint);
                        } else if (constraint.operator === OPERATORS.gteq) {
                            groomedRule.enableOn = rightOperand.toISOString().substr(0,10);
                            consumeConstraint(groomedRule.consumedConstraints.onRule, CONSUMED_CONSTRAINTS.consumed, constraint);
                        } else if (constraint.operator === OPERATORS.lt) {
                            rightOperand.setDate(rightOperand.getDate() - 1);
                            groomedRule.expireOn = rightOperand.toISOString().substr(0,10);
                            consumeConstraint(groomedRule.consumedConstraints.onRule, CONSUMED_CONSTRAINTS.consumed, constraint);
                        } else if (constraint.operator === OPERATORS.lteq) {
                            groomedRule.expireOn = rightOperand.toISOString().substr(0,10);
                            consumeConstraint(groomedRule.consumedConstraints.onRule, CONSUMED_CONSTRAINTS.consumed, constraint);
                        } else if (constraint.operator === OPERATORS.eq) {
                            groomedRule.expireOn = groomedRule.enableOn = rightOperand.toISOString().substr(0,10);
                            consumeConstraint(groomedRule.consumedConstraints.onRule, CONSUMED_CONSTRAINTS.consumed, constraint);
                        } else {
                            consumeConstraint(groomedRule.consumedConstraints.onRule, CONSUMED_CONSTRAINTS.errored, constraint);
                        }
                    }
                    if (groomedRule.expireOn && groomedRule.enableOn && groomedRule.enableOn > groomedRule.expireOn) {
                        groomedRule.enableOn = groomedRule.expireOn;
                    }
                    if (groomedRule.enableOn && res.locals.pg.txNowDate < groomedRule.enableOn) {
                        groomedRule.rightToUseActive = false;
                        groomedRule.closer = res.locals.params.userId;
                        groomedRule.closed = res.locals.pg.txNow;
                        groomedRule.closureReason = 'too soon';
                    }
                    if (groomedRule.expireOn && res.locals.pg.txNowDate > groomedRule.expireOn) {
                        groomedRule.rightToUseActive = false;
                        groomedRule.closer = res.locals.params.userId;
                        groomedRule.closed = res.locals.pg.txNow;
                        groomedRule.closureReason = 'expired';
                    }
                    groomedRule.isPerpetual = !groomedRule.expireOn;
                } else {
                    consumeConstraint(groomedRule.consumedConstraints.onRule, CONSUMED_CONSTRAINTS.ignored, constraint);
                }
            });
        }
        return groomedRule;
    });
    return groomedRules;
}

module.exports = {
    /**
     * validate the ODRL agreement to make sure the required fields are present
     * @param   {} agreement
     * @throws {InvalidDataError} when invalid data
     */
    validateAgreement(agreement) {
        if (agreement == null) {
            throw new InvalidDataError('agreement expected');
        }
        if ((agreement.permission == null && agreement.prohibition == null)) {
            throw new InvalidDataError({error: 'permission or prohibition expected in agreement', agreement: agreement});
        }
        const errors = [];
        if (agreement.permission) {
            if (!Array.isArray(agreement.permission))
            {
                errors.push({error: 'expected permission as array', permission: agreement.permission});
            } else {
                for (const rule of agreement.permission) {
                    if (!rule.uid) {
                        errors.push({error: 'uid expected in permission', permission: rule});
                    }
                }
            }
        }
        if (agreement.prohibition) {
            if (!Array.isArray(agreement.prohibition)) {
                errors.push({error: 'expected prohibition as array', prohibition: agreement.prohibition});
            } else {
                for (const rule of agreement.prohibition) {
                    if (!rule.uid) {
                        errors.push({error: 'uid expected in prohibition', prohibition: rule});
                    }
                }
            }
        }
        if (errors.length) {
            throw new InvalidDataError(errors);
        }
    },
    /**
     * groom the ODRL agreement to make all elements recognizable by LUM
     * @param  {} res
     * @param   {} agreement
     * @returns {} groomed copy of agreement
     */
    groomAgreement(res, agreement) {
        const groomedAgreement = {uid: agreement.uid};

        groomedAgreement.permission  = groomRules(res, agreement.permission,  'permission',  agreement);
        groomedAgreement.prohibition = groomRules(res, agreement.prohibition, 'prohibition', agreement);

        utils.logInfo(res, `groomedAgreement(${res.locals.params.assetUsageAgreementId}):`, groomedAgreement);
        return groomedAgreement;
    }
};
