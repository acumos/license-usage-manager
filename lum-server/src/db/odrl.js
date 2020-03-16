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
const lumErrors = require('../error');


const RULE_TYPES = {permission:'permission', prohibition:'prohibition'};
const OPERATORS = {lt:'lt', lteq:'lteq', eq:'eq', gt:'gt', gteq:'gteq', lumIn:'lum:in'};
const CONSUMED_CONSTRAINTS = {
    merged:'merged', overridden:'overridden', conflicted:'conflicted',
    errored:'errored', ignored:'ignored', consumed:'consumed', expanded:'expanded', unexpected:'unexpected',
    same:'same'
};

const FIELDS = {value:'@value', type: '@type'};
const TYPES = {"integer": "integer", "string": "string"};
const LEFT_OPERANDS = {
    "count": {dataType: "integer", usageConstraintOn: [RULE_TYPES.permission]},
    "date":  {dataType: "date"},
    "lum:countUniqueUsers": {dataType: "integer", assigneeConstraintOn: [RULE_TYPES.permission]},
    "lum:users": {assigneeConstraintOn: [RULE_TYPES.permission, RULE_TYPES.prohibition]}
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
 * @param  {...Object} constraints
 */
function consumeConstraint(consumedConstraints, status, ...constraints) {
    for (const constraint of constraints) {
        consumedConstraints.push(utils.deepCopyTo({consumeStatus:status}, constraint));
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
    constraint = utils.deepCopyTo({}, constraint);
    lumServer.logger.debug(res, 'groomConstraint to groom constraint', constraint);
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
    }).filter(nonEmptyItem => nonEmptyItem != null).sort();

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
    lumServer.logger.debug(res, 'mergeTwoConstraints constraint', constraint, '<- addon', addon);

    if ([constraint.operator, addon.operator].includes(OPERATORS.lumIn)) {
        if (constraint.operator === addon.operator) {
            if (JSON.stringify(constraint.rightOperand) === JSON.stringify(addon.rightOperand)) {
                consumeConstraint(consumedConstraints, CONSUMED_CONSTRAINTS.same, addon);
                return true;
            }
            consumeConstraint(consumedConstraints, CONSUMED_CONSTRAINTS.merged, constraint, addon);
            constraint.rightOperand = constraint.rightOperand.filter(x => addon.rightOperand.includes(x));
        } else if (constraint.operator === OPERATORS.lumIn) {
            consumeConstraint(consumedConstraints, CONSUMED_CONSTRAINTS.merged, constraint, addon);
            constraint.rightOperand = constraint.rightOperand.filter(x => compareTwoValues(addon.operator, x, addon.rightOperand));
        } else {
            consumeConstraint(consumedConstraints, CONSUMED_CONSTRAINTS.merged, constraint, addon);
            constraint.operator = OPERATORS.lumIn;
            constraint.dataType = addon.dataType;
            constraint.rightOperand = addon.rightOperand.filter(x => compareTwoValues(constraint.operator, x, constraint.rightOperand));
        }
        lumServer.logger.debug(res, 'merged mergeTwoConstraints constraint', constraint);
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
            lumServer.logger.debug(res, 'merged mergeTwoConstraints constraint', constraint);
            return true;
        }
        if (compareTwoValues(constraint.operator, addon.rightOperand, constraint.rightOperand)) {
            consumeConstraint(consumedConstraints, CONSUMED_CONSTRAINTS.overridden, constraint);
            utils.deepCopyTo(constraint, addon);
        } else {
            consumeConstraint(consumedConstraints, CONSUMED_CONSTRAINTS.ignored, addon);
        }
        lumServer.logger.debug(res, 'merged mergeTwoConstraints constraint', constraint);
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
        lumServer.logger.debug(res, 'merged mergeTwoConstraints constraint', constraint);
        return true;
    }
    if (addon.operator === OPERATORS.eq) {
        if (compareTwoValues(constraint.operator, addon.rightOperand, constraint.rightOperand)) {
            consumeConstraint(consumedConstraints, CONSUMED_CONSTRAINTS.overridden, constraint);
            utils.deepCopyTo(constraint, addon);
        } else {
            consumeConstraint(consumedConstraints, CONSUMED_CONSTRAINTS.conflicted, constraint, addon);
            constraint.rightOperand = null;
        }
        lumServer.logger.debug(res, 'merged mergeTwoConstraints constraint', constraint);
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
        utils.deepCopyTo(constraint, addon);
    }
    lumServer.logger.debug(res, 'merged mergeTwoConstraints constraint', constraint);
    return true;
}
/**
 * merge restriction to the prohibition constraint
 *
 * @param  {} res
 * @param  {} constraint initial constraint
 * @param  {} expansion constraint to add to initial constraint
 * @param  {} consumedConstraints collection of merged and conflicted constraints
 *                                that got consumed by grooming
 */
function expandProhibitionConstraint(res, constraint, expansion, consumedConstraints) {
    if (!constraint || !expansion) {return;}
    lumServer.logger.debug(res, 'expandProhibitionConstraint', constraint, '<- expansion', expansion);

    if ([constraint.operator, expansion.operator].includes(OPERATORS.lumIn)) {
        if (constraint.operator === expansion.operator) {
            const toAdd = expansion.rightOperand.filter(x => !constraint.rightOperand.includes(x));
            if (toAdd.length) {
                consumeConstraint(consumedConstraints, CONSUMED_CONSTRAINTS.expanded, constraint, expansion);
                Array.prototype.push.apply(constraint.rightOperand, toAdd);
                constraint.rightOperand.sort();
                constraint.expanded = true;
                lumServer.logger.debug(res, 'expanded constraint', constraint);
            } else {
                consumeConstraint(consumedConstraints, CONSUMED_CONSTRAINTS.ignored, expansion);
                lumServer.logger.debug(res, 'ignored expansion for constraint', constraint);
            }
        } else {
            consumeConstraint(consumedConstraints, CONSUMED_CONSTRAINTS.ignored, expansion);
            lumServer.logger.debug(res, 'ignored expansion for constraint', constraint);
        }
        return;
    }

    if (constraint.operator === expansion.operator) {
        if (constraint.operator === OPERATORS.eq) {
            consumeConstraint(consumedConstraints, CONSUMED_CONSTRAINTS.ignored, expansion);
            lumServer.logger.debug(res, 'ignored expansion for constraint', constraint);
            return;
        }
        if (compareTwoValues(constraint.operator, constraint.rightOperand, expansion.rightOperand)) {
            consumeConstraint(consumedConstraints, CONSUMED_CONSTRAINTS.expanded, constraint);
            utils.deepCopyTo(constraint, expansion);
            constraint.expanded = true;
            lumServer.logger.debug(res, 'expanded constraint', constraint);
        } else {
            consumeConstraint(consumedConstraints, CONSUMED_CONSTRAINTS.ignored, expansion);
            lumServer.logger.debug(res, 'ignored expansion for constraint', constraint);
        }
        return;
    }

    // ... here when different operators...
    if (constraint.operator === OPERATORS.eq) {
        consumeConstraint(consumedConstraints, CONSUMED_CONSTRAINTS.ignored, expansion);
        lumServer.logger.debug(res, 'ignored expansion for constraint', constraint);
        return;
    }
    if (expansion.operator === OPERATORS.eq) {
        consumeConstraint(consumedConstraints, CONSUMED_CONSTRAINTS.ignored, expansion);
        lumServer.logger.debug(res, 'ignored expansion for constraint', constraint);
        return;
    }

    const similarOperators = getSimilarOperators(constraint.operator);
    if (!similarOperators.includes(expansion.operator) || similarOperators.length === 1) {
        consumeConstraint(consumedConstraints, CONSUMED_CONSTRAINTS.ignored, expansion);
        lumServer.logger.debug(res, 'ignored expansion for constraint', constraint);
        return;
    }
    const weakOperator = similarOperators[similarOperators.length - 1];

    if (constraint.rightOperand == expansion.rightOperand) {
        if (constraint.operator !== weakOperator) {
            consumeConstraint(consumedConstraints, CONSUMED_CONSTRAINTS.expanded, constraint, expansion);
            constraint.operator = weakOperator;
            constraint.expanded = true;
            lumServer.logger.debug(res, 'expanded constraint', constraint);
        } else {
            consumeConstraint(consumedConstraints, CONSUMED_CONSTRAINTS.ignored, expansion);
            lumServer.logger.debug(res, 'ignored expansion for constraint', constraint);
        }
        return;
    }

    if (compareTwoValues(weakOperator, constraint.rightOperand, expansion.rightOperand)) {
        consumeConstraint(consumedConstraints, CONSUMED_CONSTRAINTS.expanded, constraint);
        utils.deepCopyTo(constraint, expansion);
        constraint.expanded = true;
        lumServer.logger.debug(res, 'expanded constraint', constraint);
    }
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
        lumServer.logger.debug(res, 'groomConstraints groomed addon', addon);

        let merged = false;
        for (const constraint of mergedConstraints) {
            merged = mergeTwoConstraints(res, constraint, addon, consumedConstraints);
            if (merged) {
                lumServer.logger.debug(res, 'groomConstraints merged constraint', constraint);
                break;
            }
        }
        if (!merged) {
            lumServer.logger.debug(res, 'groomConstraints added addon', addon);
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
 * @param  {} agreement parent agreement contains keys and default target and assignee
 * @returns dict of rules keyed by uid of the rule
 * @throws {InvalidDataError} when non-unique uid is found on two or more rules
 */
function groomRules(res, rules, assetUsageRuleType, agreement) {
    if (rules == null) {return;}
    if (!Array.isArray(rules)) {rules = [rules];}

    const errors = [];

    const groomedRules = rules.map(rule => {
        const groomedRule = {
            uid:                 rule.uid,
            assetUsageRuleType:  assetUsageRuleType,
            actionProvided:      !!rule.action,
            actions:             groomAction(rule.action),
            isPerpetual:         true,
            enableOn:            null,
            expireOn:            null,
            targetRefinement:    {},
            assigneeRefinement:  {},
            assigneeMetrics:     {users: []},
            usageConstraints:    {},
            consumedConstraints: {onTarget:[], onAssignee:[], onRule:[]}
        };
        const ruleInfo = `groom ${groomedRule.assetUsageRuleType}(${groomedRule.uid})`;
        const targetRefinement = groomRefinement(res, rule.target, agreement.target,
                                                 groomedRule.consumedConstraints.onTarget);
        if (targetRefinement) {
            lumServer.logger.debug(res, `${ruleInfo} targetRefinement`, targetRefinement);
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
            lumServer.logger.debug(res, `${ruleInfo} assigneeRefinement`, assigneeRefinement);
            assigneeRefinement.forEach(arfn => {
                if (!((LEFT_OPERANDS[arfn.leftOperand] || {}).assigneeConstraintOn || []).includes(assetUsageRuleType)) {
                    lumServer.logger.debug(res, `groomRules unexpected assignee constraint`, arfn, 'on', assetUsageRuleType);
                    consumeConstraint(groomedRule.consumedConstraints.onAssignee, CONSUMED_CONSTRAINTS.unexpected, arfn);
                    return;
                }
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
            lumServer.logger.debug(res, `${ruleInfo} constraints`, constraints);
            constraints.forEach(constraint => {
                if (((LEFT_OPERANDS[constraint.leftOperand] || {}).usageConstraintOn || []).includes(assetUsageRuleType)) {
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
                    setTimingFieldsOnRule(res, groomedRule);
                } else {
                    lumServer.logger.debug(res, `groomRules unexpected constraint`, constraint, 'on', assetUsageRuleType);
                    consumeConstraint(groomedRule.consumedConstraints.onRule, CONSUMED_CONSTRAINTS.unexpected, constraint);
                }
            });
        }
        return groomedRule;
    }).reduce((target, grRule) => {
        if (grRule.uid in target) {
            lumErrors.addError(errors, `non-unique uid(${grRule.uid}) on ${assetUsageRuleType}`, assetUsageRuleType, grRule);
        }
        target[grRule.uid] = grRule;
        return target;
    }, {});
    if (errors.length) {
        throw new lumErrors.InvalidDataError(errors);
    }
    return groomedRules;
}
/**
 * set timing related fields on the rule
 * @param  {} res
 * @param  {} groomedRule
 */
function setTimingFieldsOnRule(res, groomedRule) {
    if (groomedRule.expireOn && groomedRule.enableOn && groomedRule.enableOn > groomedRule.expireOn) {
        groomedRule.enableOn = groomedRule.expireOn;
    }
    groomedRule.isPerpetual = !groomedRule.expireOn;
}

/**
 * apply single permission-restriction over the permission on the groomed agreement.
 *
 * agreement-restriction makes permission less permissive
 * @param  {} res
 * @param  {} groomedAgreement
 * @param  {} restriction
 */
function restrictPermission(res, groomedAgreement, restriction) {
    const permission = (groomedAgreement.permission || {})[restriction.uid];
    if (!permission) {
        groomedAgreement.ignoredPermissionRestrictions[restriction.uid] = restriction;
        return;
    }

    if (restriction.actionProvided) {
        permission.actions = permission.actions.filter(x => restriction.actions.includes(x));
    }

    restrictTiming(res, permission, restriction);

    if (restriction.targetRefinement) {
        if (!permission.targetRefinement) {permission.targetRefinement = {};}
        for (const targetRestr of Object.values(restriction.targetRefinement)) {
            targetRestr.origin = 'fromRestriction';
            const targetRfn = permission.targetRefinement[targetRestr.leftOperand];
            if (!targetRfn) {
                permission.targetRefinement[targetRestr.leftOperand] = targetRestr;
                continue;
            }
            if (!mergeTwoConstraints(res, targetRfn, targetRestr, permission.consumedConstraints.onTarget)) {
                consumeConstraint(permission.consumedConstraints.onTarget, CONSUMED_CONSTRAINTS.ignored, targetRestr);
            }
        }
    }

    if (restriction.assigneeRefinement) {
        if (!permission.assigneeRefinement) {permission.assigneeRefinement = {};}
        for (const assigneeRestr of Object.values(restriction.assigneeRefinement)) {
            assigneeRestr.origin = 'fromRestriction';
            const assigneeRfn = permission.assigneeRefinement[assigneeRestr.leftOperand];
            if (!assigneeRfn) {
                permission.assigneeRefinement[assigneeRestr.leftOperand] = assigneeRestr;
                continue;
            }
            if (!mergeTwoConstraints(res, assigneeRfn, assigneeRestr, permission.consumedConstraints.onAssignee)) {
                consumeConstraint(permission.consumedConstraints.onAssignee, CONSUMED_CONSTRAINTS.ignored, assigneeRestr);
            }
        }
    }

    if (restriction.usageConstraints) {
        if (!permission.usageConstraints) {permission.usageConstraints = {};}
        for (const usageRestr of Object.values(restriction.usageConstraints)) {
            usageRestr.origin = 'fromRestriction';
            const usageConstr = permission.usageConstraints[usageRestr.leftOperand];
            if (!usageConstr) {
                permission.usageConstraints[usageRestr.leftOperand] = usageRestr;
                continue;
            }
            if (!mergeTwoConstraints(res, usageConstr, usageRestr, permission.consumedConstraints.onRule)) {
                consumeConstraint(permission.consumedConstraints.onRule, CONSUMED_CONSTRAINTS.ignored, usageRestr);
            }
        }
    }
}
/**
 * make permission to have narrower timing
 * @param  {} res
 * @param  {} permission
 * @param  {} restriction
 */
function restrictTiming(res, permission, restriction) {
    if (restriction.expireOn && (permission.expireOn == null || restriction.expireOn < permission.expireOn)) {
        permission.expireOn = restriction.expireOn;
    }
    if (restriction.enableOn && (permission.enableOn == null || restriction.enableOn > permission.enableOn)) {
        permission.enableOn = restriction.enableOn;
    }
    setTimingFieldsOnRule(res, permission);
}
/**
 * make prohibition to have wider timing
 * @param  {} res
 * @param  {} prohibition
 * @param  {} expansion
 */
function expandTiming(res, prohibition, expansion) {
    if (expansion.expireOn == null || (prohibition.expireOn && expansion.expireOn > prohibition.expireOn)) {
        prohibition.expireOn = expansion.expireOn;
    }
    if (expansion.enableOn == null || (prohibition.enableOn && expansion.enableOn < prohibition.enableOn)) {
        prohibition.enableOn = expansion.enableOn;
    }
    setTimingFieldsOnRule(res, prohibition);
}

/**
 * init groomedAgreement.ignoredProhibitionnRestrictions
 * @param  {} groomedAgreement
 * @param  {} uid of prohibition
 */
function lazyInitIgnoredProhibitionRestrictions(groomedAgreement, uid) {
    if (uid in groomedAgreement.ignoredProhibitionRestrictions) {return;}

    groomedAgreement.ignoredProhibitionRestrictions[uid] = {
        uid: uid, targetRefinement:{}, assigneeRefinement:{}, usageConstraints:{}
    };
}
/**
 * apply single prohibition-restriction over the prohibition on the groomed agreement.
 *
 * agreement-restriction makes prohibition more prohibitive
 * @param  {} res
 * @param  {} groomedAgreement
 * @param  {} expansion
 */
function expandProhibition(res, groomedAgreement, expansion) {
    const prohibition = (groomedAgreement.prohibition || {})[expansion.uid];
    if (!prohibition) {
        if (!groomedAgreement.prohibition) {groomedAgreement.prohibition = {};}
        groomedAgreement.prohibition[expansion.uid] = expansion;
        return;
    }
    Array.prototype.push.apply(prohibition.actions, expansion.actions.filter(x => !prohibition.actions.includes(x)))

    expandTiming(res, prohibition, expansion);

    if (expansion.targetRefinement) {
        if (!prohibition.targetRefinement) {
            lazyInitIgnoredProhibitionRestrictions(groomedAgreement, expansion.uid);
            groomedAgreement.ignoredProhibitionRestrictions[expansion.uid].targetRefinement = expansion.targetRefinement;
        } else {
            for (const targetExpansion of Object.values(expansion.targetRefinement)) {
                targetExpansion.origin = 'fromExpansion';
                const targetRfn = prohibition.targetRefinement[targetExpansion.leftOperand];
                if (!targetRfn) {
                    lazyInitIgnoredProhibitionRestrictions(groomedAgreement, expansion.uid);
                    groomedAgreement.ignoredProhibitionRestrictions[expansion.uid].targetRefinement[targetExpansion.leftOperand] = targetExpansion;
                    continue;
                }
                expandProhibitionConstraint(res, targetRfn, targetExpansion, prohibition.consumedConstraints.onTarget);
            }
        }
    }

    if (expansion.assigneeRefinement) {
        if (!prohibition.assigneeRefinement) {
            lazyInitIgnoredProhibitionRestrictions(groomedAgreement, expansion.uid);
            groomedAgreement.ignoredProhibitionRestrictions[expansion.uid].assigneeRefinement = expansion.assigneeRefinement;
        } else {
            for (const assigneeExpansion of Object.values(expansion.assigneeRefinement)) {
                assigneeExpansion.origin = 'fromExpansion';
                const assigneeRfn = prohibition.assigneeRefinement[assigneeExpansion.leftOperand];
                if (!assigneeRfn) {
                    lazyInitIgnoredProhibitionRestrictions(groomedAgreement, expansion.uid);
                    groomedAgreement.ignoredProhibitionRestrictions[expansion.uid].assigneeRefinement[assigneeExpansion.leftOperand] = assigneeExpansion;
                    continue;
                }
                expandProhibitionConstraint(res, assigneeRfn, assigneeExpansion, prohibition.consumedConstraints.onAssignee);
            }
        }
    }

    if (expansion.usageConstraints) {
        if (!prohibition.usageConstraints) {
            lazyInitIgnoredProhibitionRestrictions(groomedAgreement, expansion.uid);
            groomedAgreement.ignoredProhibitionRestrictions[expansion.uid].usageConstraints = expansion.usageConstraints;
        } else {
            for (const usageExpansion of Object.values(expansion.usageConstraints)) {
                usageExpansion.origin = 'fromExpansion';
                const usageConstr = prohibition.usageConstraints[usageExpansion.leftOperand];
                if (!usageConstr) {
                    lazyInitIgnoredProhibitionRestrictions(groomedAgreement, expansion.uid);
                    groomedAgreement.ignoredProhibitionRestrictions[expansion.uid].usageConstraints[usageExpansion.leftOperand] = usageExpansion;
                    continue;
                }
                expandProhibitionConstraint(res, usageConstr, usageExpansion, prohibition.consumedConstraints.onRule);
            }
        }
    }
}

module.exports = {
    RULE_TYPES: RULE_TYPES,
    OPERATORS: OPERATORS,
    /**
     * validate the ODRL agreement to make sure the required fields are present
     * @param  {Object[]} errors collection of errors
     * @param  {} agreement
     * @param  {string} agreementObjectName either agreement or agreementRestriction
     */
    validateAgreement(errors, agreement, agreementObjectName) {
        if ((agreement.permission == null && agreement.prohibition == null)) {
            return lumErrors.addError(errors, `permission or prohibition expected in ${agreementObjectName}`, `${agreementObjectName}`, agreement);
        }
        if (agreement.permission) {
            if (!Array.isArray(agreement.permission)) {
                lumErrors.addError(errors, 'expected permission as array', 'permission', agreement.permission);
            } else {
                agreement.permission.reduce((target, rule) => {
                    if (!rule.uid) {
                        lumErrors.addError(errors, 'uid expected in permission', 'permission', rule);
                        return target;
                    }
                    if (rule.uid in target) {
                        lumErrors.addError(errors, `non-unique uid(${rule.uid}) on permission`, 'permission', rule);
                    }
                    target[rule.uid] = rule;
                    return target;
                }, {});
            }
        }
        if (agreement.prohibition) {
            if (!Array.isArray(agreement.prohibition)) {
                lumErrors.addError(errors, 'expected prohibition as array', 'prohibition', agreement.prohibition);
            } else {
                agreement.prohibition.reduce((target, rule) => {
                    if (!rule.uid) {
                        lumErrors.addError(errors, 'uid expected in prohibition', 'prohibition', rule);
                        return target;
                    }
                    if (rule.uid in target) {
                        lumErrors.addError(errors, `non-unique uid(${rule.uid}) on prohibition`, 'prohibition', rule);
                    }
                    target[rule.uid] = rule;
                    return target;
                }, {});
            }
        }
    },
    /**
     * groom the ODRL agreement to make all elements recognizable by LUM and
     * apply agreement-restriction over the agreement.
     * @param   {} res
     * @param   {} agreement
     * @param   {} [agreementRestriction]
     * @returns {} groomed copy of agreement
     * @throws {InvalidDataError} by groomRules when non-unique uid is found on two or more rules
     */
    groomAgreement(res, agreement, agreementRestriction) {
        const groomedAgreement = {
            uid: agreement.uid,
            initialAgreement: utils.deepCopyTo({}, agreement),
            permission: groomRules(res, agreement.permission,   RULE_TYPES.permission,  agreement),
            prohibition: groomRules(res, agreement.prohibition, RULE_TYPES.prohibition, agreement),
            restriction: null,
            ignoredPermissionRestrictions: {},
            ignoredProhibitionRestrictions: {}
        };

        if (agreementRestriction) {
            groomedAgreement.restriction = {
                uid: agreementRestriction.uid,
                permission:  groomRules(res, agreementRestriction.permission,  RULE_TYPES.permission,  agreementRestriction),
                prohibition: groomRules(res, agreementRestriction.prohibition, RULE_TYPES.prohibition, agreementRestriction)
            };

            for (const restriction of Object.values(groomedAgreement.restriction.permission || {})) {
                restrictPermission(res, groomedAgreement, restriction);
            }

            for (const expansion of Object.values(groomedAgreement.restriction.prohibition || {})) {
                expandProhibition(res, groomedAgreement, expansion);
            }
        }

        lumServer.logger.debug(res, `groomedAgreement(${res.locals.paramKeys}):`, groomedAgreement);
        return groomedAgreement;
    }
};

