// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { EventContext } from '../events/EventContext.js';
import { InvalidEventContextPropertyError } from './InvalidEventContextPropertyError.js';

// EventContext is an interface (erased at runtime). Keep this exhaustive against its keys so
// additions/removals to the SDK type cannot silently leave registration validation out of date.
const contextProperties = {
    sequenceNumber: true,
    eventSourceId: true,
    eventStore: true,
    namespace: true,
    eventSourceType: true,
    eventStreamType: true,
    eventStreamId: true,
    subject: true,
    hash: true,
    causedBy: true,
    observationState: true,
    eventType: true,
    occurred: true,
    correlationId: true,
    causation: true,
    tags: true
} satisfies Record<keyof EventContext, true>;

// Mirror the kernel's DerivedPropertyFunctions registry: Week() applies to dates only.
const derivedFunctions: Record<string, string> = { week: 'Week' };
const dateProperties = new Set(['occurred']);
const identityProperties = new Set(['subject', 'name', 'userName']);

function lower(segment: string): string {
    return segment.charAt(0).toLowerCase() + segment.slice(1);
}

// Accept only paths the kernel can resolve: a root property or an identity member of causedBy.
// causedBy.onBehalfOf is allowed only as a whole value: traversing it when it is missing makes the
// kernel construct identities recursively. Nothing inside the causation or tags collections, which a
// dotted path cannot traverse.
function validNestedPath(root: string, segments: string[]): boolean {
    if (segments.length === 0) return true;
    if (root !== 'causedBy') return false;
    const members = segments.map(lower);
    return members.length === 1 && (identityProperties.has(members[0]) || members[0] === 'onBehalfOf');
}

/** Build the expression read by Chronicle's event-context resolver, using CLR property casing. */
export function eventContextPropertyExpression(propertyPath: string): string {
    // The kernel accepts dotted CLR paths (and terminal derived-property functions) using
    // [A-Za-z.()]. Reject unsupported characters and unknown root properties before registration.
    const segments = propertyPath.split('.');
    const contextProperty = segments[0].charAt(0).toLowerCase() + segments[0].slice(1);
    if (!/^[A-Za-z]+(?:\.[A-Za-z]+)*(?:\(\))?$/.test(propertyPath) ||
        !Object.hasOwn(contextProperties, contextProperty)) {
        throw new InvalidEventContextPropertyError(propertyPath);
    }
    const lastIndex = segments.length - 1;
    const isFunction = segments[lastIndex].endsWith('()');
    if (isFunction) {
        const functionName = segments[lastIndex].slice(0, -2).toLowerCase();
        if (!Object.hasOwn(derivedFunctions, functionName) || lastIndex !== 1 || !dateProperties.has(contextProperty)) {
            throw new InvalidEventContextPropertyError(propertyPath);
        }
        segments[lastIndex] = derivedFunctions[functionName];
    } else if (segments.some(segment => Object.hasOwn(derivedFunctions, segment.toLowerCase())) ||
        !validNestedPath(contextProperty, segments.slice(1))) {
        throw new InvalidEventContextPropertyError(propertyPath);
    }
    const clrPath = segments.map(segment => segment.charAt(0).toUpperCase() + segment.slice(1)).join('.');
    return `$eventContext(${clrPath}${propertyPath.endsWith('()') ? '()' : ''})`;
}
