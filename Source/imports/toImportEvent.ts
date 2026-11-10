// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { Guid, JsonSerializer } from '@cratis/fundamentals';
import type { Identity as ContractsIdentity, ImportEvent } from '@cratis/chronicle.contracts';
import { resolveEventSubject } from '../compliance/resolveEventSubject.js';
import { toContractsGuid } from '../connection/Guid.js';
import { getEventTypeFor } from '../events/eventTypeDecorator.js';
import { mergeNamedTags } from '../events/mergeNamedTags.js';
import { mergeTags } from '../events/mergeTags.js';
import { getTagsFor } from '../events/tagDecorator.js';
import type { IEventSources } from '../eventSources/IEventSources.js';
import type { EventForEventSourceId } from '../eventSequences/EventForEventSourceId.js';
import { resolveBatchRouting } from '../eventSequences/resolveEventSourceRouting.js';
import type { Identity } from '../identity/Identity.js';

/**
 * Converts an event to the form an import sends it in, keeping everything the event says about its source.
 * @param event - The {@link EventForEventSourceId}.
 * @param eventSources - The registered event sources, for events routed through a definition.
 * @returns The {@link ImportEvent}.
 * @remarks
 * What the event does not say is left for the kernel to resolve: an omitted occurrence time, subject, route or
 * correlation is not filled in from the importing process.
 */
export function toImportEvent(event: EventForEventSourceId, eventSources?: IEventSources): ImportEvent {
    const routing = resolveBatchRouting(eventSources, event);
    const eventType = getEventTypeFor(event.event.constructor as Function);
    return {
        EventSourceId: event.eventSourceId,
        EventSourceType: routing?.sourceType ?? event.eventSourceType ?? '',
        EventStreamType: routing?.streamType ?? event.eventStreamType ?? '',
        EventStreamId: event.eventStreamId ?? '',
        EventType: {
            Id: eventType.id.value,
            Generation: event.generation ?? eventType.generation.value,
            Tombstone: eventType.tombstone
        },
        Content: JsonSerializer.serialize(event.event),
        Tags: mergeTags(getTagsFor(event.event.constructor as Function), event.tags),
        NamedTags: mergeNamedTags(event.namedTags).map(tag => ({ Name: tag.name, Value: tag.value })),
        Occurred: event.occurred === undefined ? undefined : { Value: event.occurred.toISOString() },
        Subject: event.subject ?? resolveEventSubject(event.event) ?? '',
        CorrelationId: event.correlationId === undefined ? undefined : toContractsGuid(Guid.as(event.correlationId)),
        Causation: [],
        CausedBy: event.causedBy === undefined ? undefined : toContractsIdentity(event.causedBy),
        IdempotencyKey: '',
        EventSource: routing?.eventSource ?? '',
        SourceSequenceNumber: event.sourceSequenceNumber === undefined ? 0n : BigInt(event.sourceSequenceNumber)
    };
}

function toContractsIdentity(identity: Identity): ContractsIdentity {
    return {
        Subject: identity.subject,
        Name: identity.name,
        UserName: identity.userName,
        OnBehalfOf: identity.onBehalfOf === undefined ? undefined : toContractsIdentity(identity.onBehalfOf)
    };
}
