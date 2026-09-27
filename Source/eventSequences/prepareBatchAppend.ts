// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { Guid, JsonSerializer } from '@cratis/fundamentals';
import { causationManager, CausationType } from '../auditing/index.js';
import { correlationIdManager } from '../correlation/index.js';
import { getEventTypeFor } from '../events/eventTypeDecorator.js';
import { getTagsFor } from '../events/tagDecorator.js';
import { mergeTags } from '../events/mergeTags.js';
import { identityProvider } from '../identity/index.js';
import type { AppendOptions } from './AppendOptions.js';
import type { EventForEventSourceId } from './EventForEventSourceId.js';
import type { ConcurrencyScope } from './ConcurrencyScope.js';

/** Shared production batch argument validation and wire-event preparation. */
export function prepareBatchAppend(
    eventSourceIdOrEvents: string | EventForEventSourceId[],
    eventsOrOptions?: object[] | AppendOptions,
    options?: AppendOptions
) {
    if (typeof eventSourceIdOrEvents !== 'string' && !Array.isArray(eventSourceIdOrEvents)) {
        throw new Error('Invalid arguments: first parameter must be an eventSourceId string or an array of { eventSourceId, event }.');
    }
    if (typeof eventSourceIdOrEvents === 'string' && !Array.isArray(eventsOrOptions)) {
        throw new Error('Invalid arguments: use appendMany(eventSourceId, events, options?) where the second parameter is an array of events.');
    }
    if (typeof eventSourceIdOrEvents !== 'string' && Array.isArray(eventsOrOptions)) {
        throw new Error('Invalid arguments: use appendMany(eventsForEventSourceId, options?) where the second parameter is append options.');
    }

    const eventsForEventSourceIds: EventForEventSourceId[] = typeof eventSourceIdOrEvents === 'string'
        ? (eventsOrOptions as object[]).map(event => ({ eventSourceId: eventSourceIdOrEvents, event }))
        : eventSourceIdOrEvents;
    const appendOptions = typeof eventSourceIdOrEvents === 'string' ? options : eventsOrOptions as AppendOptions | undefined;
    if (eventsForEventSourceIds.length === 0 && Object.keys(appendOptions?.concurrencyScopes ?? {}).length > 0) {
        throw new Error('Chronicle requires at least one event to validate concurrency scopes.');
    }
    const correlationId = appendOptions?.correlationId === undefined
        ? Guid.as(correlationIdManager.current.value) : Guid.as(appendOptions.correlationId);
    const batchCausationChain = causationManager.run(CausationType.appendManyEvents, { count: String(eventsForEventSourceIds.length) },
        () => causationManager.getCurrentChain());
    const identity = identityProvider.getCurrent();
    const concurrencyScopes = new Map<string, ConcurrencyScope | undefined>(Object.entries(appendOptions?.concurrencyScopes ?? {}));
    for (const { eventSourceId } of eventsForEventSourceIds) {
        if (!concurrencyScopes.has(eventSourceId)) concurrencyScopes.set(eventSourceId, appendOptions?.concurrencyScope);
    }
    const eventsToAppend = eventsForEventSourceIds.map(({ eventSourceId, event, eventStreamType, eventStreamId, eventSourceType, subject, occurred, tags: instanceTags }) => {
        const eventType = getEventTypeFor(event.constructor as Function);
        const tags = mergeTags(getTagsFor(event.constructor as Function), instanceTags, appendOptions?.tags);
        const occurrenceTime = occurred ?? appendOptions?.occurred;
        return {
            EventSourceType: eventSourceType ?? appendOptions?.sourceType,
            EventSourceId: eventSourceId,
            EventStreamType: eventStreamType ?? appendOptions?.streamType,
            EventStreamId: eventStreamId ?? appendOptions?.streamId,
            EventType: { Id: eventType.id.value, Generation: eventType.generation.value, Tombstone: eventType.tombstone },
            Content: JsonSerializer.serialize(event), Tags: tags,
            Occurred: occurrenceTime === undefined ? undefined : { Value: occurrenceTime.toISOString() },
            Subject: subject ?? appendOptions?.subject ?? eventSourceId
        };
    });
    return { eventsForEventSourceIds, appendOptions, correlationId, batchCausationChain, identity, concurrencyScopes, eventsToAppend };
}
