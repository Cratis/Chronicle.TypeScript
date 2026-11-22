// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { ConstraintCapture } from '../events/constraints/ConstraintBuilder.js';
import type { JsonSchema } from '../schemas/JsonSchema.js';

/** The two independent, single-property definitions measured in constraints-overlapping-definitions.json. */
export function supportsPropertyOverlap(definitions: ReadonlyMap<string, ConstraintCapture>, schemas: ReadonlyMap<string, JsonSchema>): boolean {
    if (definitions.size !== 2) return false;
    const [first, second] = [...definitions.values()];
    if (!isIndependentProperty(first) || !isIndependentProperty(second)) return false;
    if (JSON.stringify(first.scope) !== JSON.stringify(second.scope)) return false;
    const left = first.uniqueConstraint!.eventDefinitions;
    const right = second.uniqueConstraint!.eventDefinitions;
    return left.length === right.length && left.every(entry => {
        const other = right.find(candidate => candidate.eventTypeId === entry.eventTypeId);
        if (!other || other.properties[0] === entry.properties[0]) return false;
        return [entry.properties[0], other.properties[0]].every(property => {
            const field = schemas.get(entry.eventTypeId)?.properties?.[property];
            return isProvenOverlapKey(field);
        });
    });
}

function isProvenOverlapKey(schema: JsonSchema | undefined): boolean {
    if (schema?.type === 'number') return schema.format === undefined;
    if (schema?.type === 'string') return schema.format === undefined || schema.format === 'guid';
    return false;
}

function isIndependentProperty(capture: ConstraintCapture): boolean {
    const unique = capture.uniqueConstraint;
    return !!unique && !capture.uniqueEventType && !unique.ignoreCasing &&
        unique.removedWithEventTypeId === undefined && !unique.removedWithEventTypeIds?.length &&
        unique.eventDefinitions.length > 0 && unique.eventDefinitions.every(entry => entry.properties.length === 1);
}
