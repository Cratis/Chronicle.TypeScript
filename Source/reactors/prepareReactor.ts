// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { ReactorMessage } from '@cratis/chronicle.contracts';
import { createHandlerInstanceValidator } from '../observation/createHandlerInstanceValidator.js';
import { EventSequenceId } from '../eventSequences/EventSequenceId.js';
import { toWireGenerationDelivery } from '../observation/EventGenerationDelivery.js';
import { getEventTypeMetadata } from '../events/eventTypeDecorator.js';
import { getTagsFor } from '../events/tagDecorator.js';
import { getFilterTagsFor } from '../events/filterEventsByTagDecorator.js';
import { getEventSourceTypeFor } from '../events/eventSourceTypeDecorator.js';
import { getEventStreamTypeFor } from '../events/eventStreamTypeDecorator.js';
import { toPageDelivery } from '../observation/batches/batchSize.js';
import type { IClientArtifactsProvider } from '../artifacts/IClientArtifactsProvider.js';
import type { ReactorSubscription } from './ReactorSubscription.js';
import type { ReactorRegistration } from './ReactorRegistration.js';
import type { IReactorDefinition } from './IReactorDefinition.js';
import { ReactorRegistrationKind } from './ReactorRegistrationKind.js';
import { getReactorMetadata } from './reactor.js';
import { isOnceOnly } from './onceOnly.js';
import { isStartAtTail } from './startAtTail.js';
import { getReactorBatchMethods, getReactorEventTypes } from './ReactorDispatcher.js';

function validateRuntimeDefinition(definition: IReactorDefinition, artifacts: IClientArtifactsProvider): void {
    if (!definition.id.value.trim()) throw new Error('Reactor id must not be empty.');
    if (!definition.eventTypes.length) throw new Error('Reactor must subscribe to at least one event type.');
    const known = artifacts.eventTypes.map(type => getEventTypeMetadata(type)?.eventType.id.value);
    for (const type of definition.eventTypes) {
        if (!known.includes(type.id.value)) throw new Error(`Reactor event type '${type.id.value}' has no registered event type.`);
    }
}

/** Resolves handler validation before opening any stream in a registration batch. */
export function prepareReactor(registration: ReactorRegistration, artifacts: IClientArtifactsProvider) {
    if (registration.kind !== ReactorRegistrationKind.Discovered) {
        const definition = registration.definition;
        validateRuntimeDefinition(definition, artifacts);
        return {
            id: registration.id, reactorType: undefined, runtime: definition,
            eventSequenceId: definition.eventSequenceId.value,
            entries: definition.eventTypes.map(type => ({ id: type.id.value, generation: type.generation.value })),
            batchMethods: [], validateInstance: (_instance: object) => {},
            isReplayable: definition.isReplayable,
            generationDelivery: definition.generationDelivery
        };
    }
    const type = registration.type;
    const entries = getReactorEventTypes(type, artifacts.eventTypes);
    const batchMethods = getReactorBatchMethods(type, artifacts.eventTypes);
    return {
        id: registration.id, reactorType: type, runtime: undefined,
        eventSequenceId: getReactorMetadata(type)!.eventSequenceId ?? EventSequenceId.eventLog.value,
        entries, batchMethods,
        validateInstance: createHandlerInstanceValidator(type, [
            ...entries.flatMap(entry => [entry.methodName, entry.replayMethodName].filter((name): name is string => !!name)),
            ...batchMethods.map(method => method.methodName)
        ]),
        isReplayable: !isOnceOnly(type),
        generationDelivery: getReactorMetadata(type)!.generationDelivery
    };
}

/** Creates the protocol subscription, without implying remote acknowledgment. */
export function reactorSubscriptionMessage(subscription: ReactorSubscription, scope: {
    connectionId: string; eventStore: string; namespace: string;
}): ReactorMessage {
    const { reactorType: type } = subscription;
    return { Content: { Value0: {
        ConnectionId: scope.connectionId, EventStore: scope.eventStore, Namespace: scope.namespace,
        Reactor: {
            ReactorId: subscription.id, EventSequenceId: subscription.eventSequenceId,
            EventTypes: [...subscription.entries, ...subscription.batchMethods.flatMap(method => [...method.eventTypes.values()])].map(entry => ({
                EventType: { Id: entry.id, Generation: entry.generation, Tombstone: false }, Key: '$eventSourceId'
            })),
            IsReplayable: subscription.isReplayable, IsNotReplayable: !subscription.isReplayable,
            StartAtTail: type ? isStartAtTail(type) : false,
            GenerationDelivery: toWireGenerationDelivery(subscription.generationDelivery),
            Tags: type ? getTagsFor(type).map(tag => tag.value) : [],
            Filters: {
                FilterTags: type ? getFilterTagsFor(type).map(tag => tag.value) : [],
                EventSourceType: type ? getEventSourceTypeFor(type) : '',
                EventStreamType: type ? getEventStreamTypeFor(type) : 'All'
            }
        },
        PageDelivery: type ? toPageDelivery(type) : undefined
    }, Value1: undefined } };
}
