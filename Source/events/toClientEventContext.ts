// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { fromContractsGuid } from '../connection/Guid.js';
import { Identity } from '../identity/Identity.js';
import type { EventContext } from './EventContext.js';
import { EventType } from './EventType.js';
import { EventTypeGeneration } from './EventTypeGeneration.js';
import { EventTypeId } from './EventTypeId.js';
import { Tag } from './Tag.js';
import type { WireEventContext } from './WireEventContext.js';

/** Converts kernel metadata identically for reads, reactors, and reducers. */
export function toClientEventContext(context: WireEventContext): EventContext {
    return {
        eventStore: context.EventStore,
        namespace: context.Namespace,
        sequenceNumber: context.SequenceNumber,
        eventSourceId: context.EventSourceId,
        eventSourceType: context.EventSourceType,
        eventStreamType: context.EventStreamType,
        eventStreamId: context.EventStreamId,
        subject: context.Subject,
        hash: context.Hash,
        observationState: context.ObservationState,
        causedBy: toClientIdentity(context.CausedBy),
        eventType: new EventType(
            new EventTypeId(context.EventType?.Id ?? ''),
            new EventTypeGeneration(context.EventType?.Generation ?? EventTypeGeneration.firstValue),
            context.EventType?.Tombstone ?? false
        ),
        occurred: new Date(context.Occurred?.Value ?? ''),
        correlationId: fromContractsGuid(context.CorrelationId).toString(),
        causation: (context.Causation ?? []).map(causation => ({
            type: causation.Type,
            occurred: causation.Occurred ? new Date(causation.Occurred.Value) : undefined,
            properties: { ...causation.Properties }
        })),
        tags: (context.Tags ?? []).map(value => new Tag(value))
    };
}

function toClientIdentity(identity: WireEventContext['CausedBy']): Identity | undefined {
    return identity ? new Identity(identity.Subject, identity.Name, identity.UserName, toClientIdentity(identity.OnBehalfOf)) : undefined;
}
