// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { fromContractsGuid } from '../connection/Guid';
import { Identity } from '../identity/Identity';
import type { EventContext } from './EventContext';
import { EventType } from './EventType';
import { EventTypeGeneration } from './EventTypeGeneration';
import { EventTypeId } from './EventTypeId';
import { Tag } from './Tag';
import type { WireEventContext } from './WireEventContext';

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
