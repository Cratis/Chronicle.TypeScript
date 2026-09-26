// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { EventContext } from '../events/EventContext.js';

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

/** An invalid event-context path encountered while building a projection definition. */
export class InvalidEventContextPropertyError extends Error {
    constructor(readonly propertyPath: string) {
        super(`Invalid event context property '${propertyPath}'.`);
    }
}

/** Build the expression read by Chronicle's event-context resolver, using CLR property casing. */
export function eventContextPropertyExpression(propertyPath: string): string {
    // The kernel accepts dotted CLR paths (and terminal derived-property functions) using
    // [A-Za-z.()]. Reject unsupported characters and unknown root properties before registration.
    const firstSegment = propertyPath.split('.')[0];
    const contextProperty = firstSegment.charAt(0).toLowerCase() + firstSegment.slice(1);
    if (!/^[A-Za-z]+(?:\.[A-Za-z]+)*(?:\(\))?$/.test(propertyPath) ||
        !Object.hasOwn(contextProperties, contextProperty)) {
        throw new InvalidEventContextPropertyError(propertyPath);
    }
    const clrPath = propertyPath.split('.').map(segment => segment.charAt(0).toUpperCase() + segment.slice(1)).join('.');
    return `$eventContext(${clrPath})`;
}
