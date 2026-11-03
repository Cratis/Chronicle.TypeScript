// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Constructor } from '@cratis/fundamentals';
import { getEventTypeMetadata } from '../../events/eventTypeDecorator.js';
import { getHandledEventType } from '../../events/handles.js';
import { isOnceOnly } from '../../reactors/onceOnly.js';
import { getReplayEventType } from '../../reactors/replay.js';
import { getInstanceMethods } from '../getInstanceMethods.js';
import { EventTypeObservedByMoreThanOneMethod } from './EventTypeObservedByMoreThanOneMethod.js';
import { InvalidBatchMethod } from './InvalidBatchMethod.js';
import { getObservedEventTypes } from './observes.js';
import type { BatchMethod } from './BatchMethod.js';
import type { ObservedEventType } from './ObservedEventType.js';

/**
 * Discovers the batch methods of an observer: the methods decorated with `@observes`.
 * @param observerType - The observer class.
 * @param registeredTypes - The event types registered with the event store.
 * @param methods - The instance methods of the observer.
 * @returns The {@link BatchMethod} instances.
 * @throws {@link InvalidBatchMethod} when a batch method also declares a per-event decorator or observes an unregistered type.
 * @throws {@link EventTypeObservedByMoreThanOneMethod} when two batch methods observe the same event type.
 */
export function getBatchMethods(observerType: Constructor, registeredTypes: readonly Constructor[],
    methods: ReadonlyMap<string, Function> = getInstanceMethods(observerType)): BatchMethod[] {
    const typeName = (observerType as Function).name;
    const observedBy = new Map<string, string>();
    const batchMethods: BatchMethod[] = [];
    for (const [name, method] of methods) {
        const observed = getObservedEventTypes(method);
        if (observed.length === 0) continue;
        if (getHandledEventType(method) !== undefined) {
            throw new InvalidBatchMethod(typeName, name, 'it cannot also declare @handles. A batch method declares its event types with @observes only.');
        }
        if (getReplayEventType(method) !== undefined) {
            throw new InvalidBatchMethod(typeName, name, 'it cannot also declare @replay. Batch methods receive replayed pages; check BatchContext.isReplay.');
        }
        if (isOnceOnly(method)) {
            throw new InvalidBatchMethod(typeName, name, 'it cannot be @onceOnly. Mark the whole reactor @onceOnly, or check BatchContext.isReplay.');
        }

        const eventTypes = new Map<string, ObservedEventType>();
        for (const eventType of observed) {
            const metadata = registeredTypes.includes(eventType) ? getEventTypeMetadata(eventType) : undefined;
            if (!metadata) {
                throw new InvalidBatchMethod(typeName, name, `it observes '${(eventType as Function).name}', which has no registered event type. Register that event constructor with the event store.`);
            }
            const id = metadata.eventType.id.value;
            const previous = observedBy.get(id);
            if (previous !== undefined) {
                throw new EventTypeObservedByMoreThanOneMethod(typeName, (eventType as Function).name, [previous, name]);
            }
            observedBy.set(id, name);
            eventTypes.set(id, { type: eventType, id, generation: metadata.eventType.generation.value });
        }
        batchMethods.push({ methodName: name, eventTypes });
    }
    return batchMethods;
}

/**
 * Gets the instance methods of an observer that are not batch methods, for per-event discovery.
 * @param methods - The instance methods.
 * @param batchMethods - The batch methods.
 * @returns The methods without the batch methods.
 */
export function withoutBatchMethods(methods: ReadonlyMap<string, Function>, batchMethods: readonly BatchMethod[]): Map<string, Function> {
    const names = new Set(batchMethods.map(method => method.methodName));
    return new Map([...methods].filter(([name]) => !names.has(name)));
}

/**
 * Throws when an event type observed by a batch method is also handled by a per-event method.
 * @param observerType - The observer class.
 * @param batchMethods - The batch methods.
 * @param handlers - The per-event handlers, each with the event type identifier and the methods it reaches.
 * @throws {@link EventTypeObservedByMoreThanOneMethod} when an event type reaches both.
 */
export function assertEachEventTypeReachesOneMethod(observerType: Constructor, batchMethods: readonly BatchMethod[],
    handlers: readonly { readonly id: string; readonly methodNames: readonly string[] }[]): void {
    for (const handler of handlers) {
        const batchMethod = batchMethods.find(method => method.eventTypes.has(handler.id));
        if (batchMethod) {
            const observed = batchMethod.eventTypes.get(handler.id)!;
            throw new EventTypeObservedByMoreThanOneMethod((observerType as Function).name, (observed.type as Function).name,
                [batchMethod.methodName, ...handler.methodNames]);
        }
    }
}
