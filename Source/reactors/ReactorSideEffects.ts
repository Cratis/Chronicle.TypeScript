// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { hasEventType } from '../events/eventTypeDecorator';
import type { EventForEventSourceId } from '../eventSequences/EventForEventSourceId';
import type { IEventLog } from '../eventSequences/IEventLog';

/**
 * Represents the outcome of appending a reactor handler's returned side-effect events.
 */
export interface ReactorSideEffectResult {
    /** Whether every side-effect event appended successfully. */
    readonly isSuccess: boolean;

    /** Constraint violation and error messages, populated when {@link isSuccess} is false. */
    readonly errors: string[];
}

const noSideEffects: ReactorSideEffectResult = { isSuccess: true, errors: [] };

/**
 * Determines whether a value is shaped like an {@link EventForEventSourceId} — a plain object
 * carrying its own `eventSourceId` and `event` — rather than an event object returned directly.
 */
function isEventForEventSourceId(value: unknown): value is EventForEventSourceId {
    if (typeof value !== 'object' || value === null) {
        return false;
    }

    const candidate = value as Record<string, unknown>;
    return typeof candidate.eventSourceId === 'string' &&
        typeof candidate.event === 'object' && candidate.event !== null &&
        hasEventType((candidate.event as object).constructor as Function);
}

/**
 * Appends the events a `@reactor`-decorated class's handler method returned as side effects, in
 * a single atomic `AppendMany` call — never one append per item, which would neither be atomic
 * nor efficient.
 * @param eventLog - The {@link IEventLog} to append the side effects to.
 * @param handlerResult - Whatever the reactor handler method returned: `undefined`/`void`, a
 * single event object, an array of events, a single {@link EventForEventSourceId}, an array of
 * them, or a mix of bare events and {@link EventForEventSourceId} entries.
 * @param triggeringEventSourceId - The event source id of the event that triggered the reactor,
 * used as the target for bare event returns.
 * @param triggeringEventStreamType - The event stream type of the triggering event, used for bare
 * event returns.
 * @param triggeringEventStreamId - The event stream identifier of the triggering event, used for
 * bare event returns.
 * @returns The outcome of the append. Each {@link EventForEventSourceId} entry keeps its own
 * target (event source id, stream type/id, subject); bare events use the triggering event's.
 */
export async function appendReactorSideEffects(
    eventLog: IEventLog,
    handlerResult: unknown,
    triggeringEventSourceId: string,
    triggeringEventStreamType: string,
    triggeringEventStreamId: string
): Promise<ReactorSideEffectResult> {
    if (handlerResult === undefined || handlerResult === null) {
        return noSideEffects;
    }

    const items = Array.isArray(handlerResult) ? handlerResult : [handlerResult];
    const events: EventForEventSourceId[] = [];

    for (const item of items) {
        if (isEventForEventSourceId(item)) {
            events.push(item);
        } else if (typeof item === 'object' && item !== null && hasEventType(item.constructor as Function)) {
            events.push({
                eventSourceId: triggeringEventSourceId,
                event: item,
                eventStreamType: triggeringEventStreamType,
                eventStreamId: triggeringEventStreamId,
                subject: triggeringEventSourceId
            });
        }
        // Anything else — undefined array entries, plain objects that are neither a registered
        // event type nor EventForEventSourceId-shaped — is not a recognized side-effect and is
        // silently ignored, the same as a handler that returns Task/void.
    }

    if (events.length === 0) {
        return noSideEffects;
    }

    const results = await eventLog.appendMany(events);
    const errors = results
        .filter(result => !result.isSuccess)
        .flatMap(result => [
            ...result.constraintViolations.map(violation => violation.message),
            ...result.errors.map(error => error.message)
        ]);

    return { isSuccess: errors.length === 0, errors };
}
