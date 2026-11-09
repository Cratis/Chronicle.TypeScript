// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { constantValueExpression } from '../constantValueExpression.js';
import { getAddFromMetadata } from '../modelBound/addFrom.js';
import { getCountMetadata } from '../modelBound/count.js';
import { getDecrementMetadata } from '../modelBound/decrement.js';
import { getIncrementMetadata } from '../modelBound/increment.js';
import { getSetFromMetadata, setFromExpression } from '../modelBound/setFrom.js';
import { getSetFromContextMetadata, setFromContextExpression } from '../modelBound/setFromContext.js';
import { getSetValueMetadata } from '../modelBound/setValue.js';
import { getSubtractFromMetadata } from '../modelBound/subtractFrom.js';
import { SetOnceNotSupportedInGraph } from './SetOnceNotSupportedInGraph.js';

/**
 * Reads the property mappings the model-bound decorators on the members of a node or an edge declare per event type.
 * @param prototype - The class prototype of the node or edge.
 * @param properties - The names of the members to read.
 * @returns For each event type, the property name to expression.
 * @throws {SetOnceNotSupportedInGraph} When a member is mapped with setOnce - graph projections cannot honor it.
 */
export function readGraphMemberMappings(prototype: object, properties: Iterable<string>): Map<Function, Record<string, string>> {
    const result = new Map<Function, Record<string, string>>();
    const record = (eventType: Function, property: string, expression: string) => {
        const mappings = result.get(eventType) ?? {};
        mappings[property] = expression;
        result.set(eventType, mappings);
    };

    for (const property of properties) {
        for (const mapping of getSetFromMetadata(prototype, property)) {
            if (mapping.setOnce === true) throw new SetOnceNotSupportedInGraph(prototype.constructor, property);
            record(mapping.eventType, property, setFromExpression(mapping, property));
        }
        for (const mapping of getSetFromContextMetadata(prototype, property)) {
            if (mapping.setOnce === true) throw new SetOnceNotSupportedInGraph(prototype.constructor, property);
            record(mapping.eventType, property, setFromContextExpression(mapping, property));
        }
        for (const mapping of getSetValueMetadata(prototype, property)) {
            record(mapping.eventType, property, constantValueExpression(mapping.value));
        }
        for (const mapping of getAddFromMetadata(prototype, property)) {
            record(mapping.eventType, property, `$add(${mapping.eventPropertyName ?? property})`);
        }
        for (const mapping of getSubtractFromMetadata(prototype, property)) {
            record(mapping.eventType, property, `$subtract(${mapping.eventPropertyName ?? property})`);
        }
        for (const mapping of getIncrementMetadata(prototype, property)) {
            record(mapping.eventType, property, '$increment');
        }
        for (const mapping of getDecrementMetadata(prototype, property)) {
            record(mapping.eventType, property, '$decrement');
        }
        for (const mapping of getCountMetadata(prototype, property)) {
            record(mapping.eventType, property, '$count');
        }
    }

    return result;
}
