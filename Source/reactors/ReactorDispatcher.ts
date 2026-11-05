// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { EventObservationState } from '@cratis/chronicle.contracts';
import type { Constructor } from '@cratis/fundamentals';
import type { ActivatedArtifact } from '../artifacts/ActivatedArtifact.js';
import { ArtifactDelivery } from '../artifacts/ArtifactDelivery.js';
import { runActivated } from '../artifacts/withActivatedArtifact.js';
import type { EventContext } from '../events/EventContext.js';
import { getEventTypeMetadata } from '../events/eventTypeDecorator.js';
import { getHandledEventType } from '../events/handles.js';
import { getEventHandlers } from '../observation/getEventHandlers.js';
import { getInstanceMethods } from '../observation/getInstanceMethods.js';
import { assertEachEventTypeReachesOneMethod, getBatchMethods, withoutBatchMethods } from '../observation/batches/BatchMethods.js';
import type { BatchMethod } from '../observation/batches/BatchMethod.js';
import { isOnceOnly } from './onceOnly.js';
import { getReplayEventType } from './replay.js';
import type { ReactorServices } from './ReactorServices.js';
import type { ReactorDelivery } from './ReactorDelivery.js';

/** Internal handler catalog shared by live observations and in-process deliveries. */
export interface ReactorEventTypeEntry {
    readonly id: string;
    readonly generation: number;
    readonly methodName?: string;
    readonly replayMethodName?: string;
}

/**
 * Discovers the batch methods of a reactor, the methods decorated with \`@observes\`.
 * @param reactorType - The reactor class.
 * @param registeredTypes - The event types registered with the event store.
 * @returns The batch methods.
 */
export function getReactorBatchMethods(reactorType: Constructor, registeredTypes: readonly Constructor[]): BatchMethod[] {
    return getBatchMethods(reactorType, registeredTypes);
}

/**
 * Discovers the per-event handlers of a reactor and checks that each event type reaches exactly one method,
 * a batch method or a per-event method.
 * @param reactorType - The reactor class.
 * @param registeredTypes - The event types registered with the event store.
 * @returns The per-event handler entries.
 */
export function getReactorEventTypes(reactorType: Constructor, registeredTypes: readonly Constructor[]): ReactorEventTypeEntry[] {
    const allMethods = getInstanceMethods(reactorType);
    const batchMethods = getBatchMethods(reactorType, registeredTypes, allMethods);
    const methods = withoutBatchMethods(allMethods, batchMethods);
    const replayHandlers = new Map<string, string>();
    const eventTypes = new Map<string, { eventTypeClass: Function; id: string; generation: number }>();

    for (const eventTypeClass of registeredTypes) {
        const metadata = getEventTypeMetadata(eventTypeClass);
        if (metadata) {
            eventTypes.set((eventTypeClass as Function).name, {
                eventTypeClass: eventTypeClass as Function,
                id: metadata.eventType.id.value,
                generation: metadata.eventType.generation.value
            });
        }
    }

    for (const [name, method] of methods) {
        const replayEventType = getReplayEventType(method);
        if (replayEventType === undefined) continue;
        if (getHandledEventType(method) !== undefined) {
            throw new Error(`Handler '${name}' on reactor '${(reactorType as Function).name}' cannot combine @handles and @replay. Use separate live and replay methods.`);
        }
        const eventType = replayEventType === true
            ? eventTypes.get(name.startsWith('replay') ? name.slice('replay'.length) : '')
            : [...eventTypes.values()].find(candidate => candidate.eventTypeClass === replayEventType);
        if (!eventType) {
            throw new Error(`Replay handler '${name}' on reactor '${(reactorType as Function).name}' has no registered event type.`);
        }
        if (replayHandlers.has(eventType.id)) {
            throw new Error(`Reactor '${(reactorType as Function).name}' has multiple replay handlers for event type '${eventType.id}': '${replayHandlers.get(eventType.id)}' and '${name}'.`);
        }
        replayHandlers.set(eventType.id, name);
        methods.delete(name);
    }

    const entries = new Map<string, ReactorEventTypeEntry>(getEventHandlers(reactorType, registeredTypes, methods)
        .map(handler => [handler.id, handler]));
    for (const eventType of eventTypes.values()) {
        const replayMethodName = replayHandlers.get(eventType.id);
        if (replayMethodName) {
            entries.set(eventType.id, { id: eventType.id, generation: eventType.generation, ...entries.get(eventType.id), replayMethodName });
        }
    }
    const handlers = [...entries.values()];
    assertEachEventTypeReachesOneMethod(reactorType, batchMethods, handlers.map(handler => ({
        id: handler.id, methodNames: [handler.methodName, handler.replayMethodName].filter((name): name is string => !!name)
    })));
    return handlers;
}

export function selectReactorHandler(entries: readonly ReactorEventTypeEntry[], reactorType: Constructor,
    instance: Record<string, Function> | undefined, id: string | undefined, observationState: number):
    { methodName: string | undefined; isReplay: boolean; skipReplay: boolean } | undefined {
    const entry = entries.find(candidate => candidate.id === id);
    if (!entry) return undefined;
    const isReplay = (observationState & EventObservationState.Replay) !== 0;
    const methodName = isReplay ? (entry.replayMethodName ?? entry.methodName) : entry.methodName;
    const method = methodName ? (instance?.[methodName] ?? (reactorType.prototype as Record<string, Function>)[methodName]) : undefined;
    return { methodName, isReplay, skipReplay: isReplay && method !== undefined && isOnceOnly(method) };
}

/** Handler and returned effects execute in the same production activation boundary. */
export async function invokeReactorHandler(artifact: ActivatedArtifact<Record<string, Function>>, methodName: string,
    content: Record<string, unknown>, context: EventContext, services: ReactorServices | undefined,
    handleResult: (value: unknown) => Promise<void>, delivery: ReactorDelivery): Promise<void> {
    await runActivated(artifact, async () => {
        const result = await artifact.instance[methodName](content, context, services, delivery);
        await handleResult(result);
    }, { delivery: ArtifactDelivery.Events, eventContext: context, methodName });
}
