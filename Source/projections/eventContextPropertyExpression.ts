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

// Mirror the kernel's DerivedPropertyFunctions registry and nested record members.
const derivedFunctions: Record<string, string> = { week: 'Week' };
const identityProperties = new Set(['subject', 'name', 'userName', 'onBehalfOf']);

function validNestedPath(root: string, segments: string[]): boolean {
    if (root === 'causedBy') {
        for (let index = 0; index < segments.length; index++) {
            const member = segments[index].charAt(0).toLowerCase() + segments[index].slice(1);
            if (!identityProperties.has(member) || (member !== 'onBehalfOf' && index !== segments.length - 1)) return false;
        }
    }
    // The kernel's Causation is a collection; a dotted path cannot select one of its entries.
    if (root === 'causation' && segments.length > 0) return false;
    return true;
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
    if (segments[lastIndex].endsWith('()')) {
        const functionName = segments[lastIndex].slice(0, -2).toLowerCase();
        if (!Object.hasOwn(derivedFunctions, functionName)) {
            throw new InvalidEventContextPropertyError(propertyPath);
        }
        segments[lastIndex] = derivedFunctions[functionName];
    }
    if (!validNestedPath(contextProperty, segments.slice(1))) {
        throw new InvalidEventContextPropertyError(propertyPath);
    }
    const clrPath = segments.map(segment => segment.charAt(0).toUpperCase() + segment.slice(1)).join('.');
    return `$eventContext(${clrPath}${propertyPath.endsWith('()') ? '()' : ''})`;
}
