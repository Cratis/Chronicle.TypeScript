// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { EventObservationState } from '@cratis/chronicle.contracts';
import type { Constructor } from '@cratis/fundamentals';
import type { ActivatedArtifact } from '../artifacts/ActivatedArtifact.js';
import { ArtifactDelivery } from '../artifacts/ArtifactDelivery.js';
import { runActivated } from '../artifacts/withActivatedArtifact.js';
import type { EventContext } from '../events/EventContext.js';
import { getEventTypeMetadata } from '../events/eventTypeDecorator.js';
import { isOnceOnly } from './onceOnly.js';
import { getReplayEventType } from './replay.js';
import type { ReactorServices } from './ReactorServices.js';

/** Internal handler catalog shared by live observations and in-process deliveries. */
export interface ReactorEventTypeEntry {
    readonly id: string;
    readonly generation: number;
    readonly methodName?: string;
    readonly replayMethodName?: string;
}

export function getReactorEventTypes(reactorType: Constructor, registeredTypes: readonly Constructor[]): ReactorEventTypeEntry[] {
    const proto = reactorType.prototype as Record<string, unknown>;
    const entries: ReactorEventTypeEntry[] = [];
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

    // A derived method shadows a base method of the same name, even if it is not marked for replay.
    const seenMethods = new Set<string>();
    for (let current = proto; current && current !== Object.prototype; current = Object.getPrototypeOf(current) as Record<string, unknown>) {
        for (const name of Object.getOwnPropertyNames(current)) {
            if (seenMethods.has(name)) continue;
            seenMethods.add(name);
            const method = current[name];
            if (typeof method !== 'function') continue;
            const replayEventType = getReplayEventType(method);
            if (replayEventType === undefined) continue;

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
        }
    }

    for (const [className, eventType] of eventTypes) {
        const methodName = className.charAt(0).toLowerCase() + className.slice(1);
        const liveMethod = proto[methodName];
        const liveMethodName = typeof liveMethod === 'function' && getReplayEventType(liveMethod) === undefined ? methodName : undefined;
        const replayMethodName = replayHandlers.get(eventType.id);
        if (liveMethodName || replayMethodName) {
            entries.push({ id: eventType.id, generation: eventType.generation, methodName: liveMethodName, replayMethodName });
        }
    }
    return entries;
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
    handleResult: (value: unknown) => Promise<void>): Promise<void> {
    await runActivated(artifact, async () => {
        const result = await artifact.instance[methodName](content, context, services);
        await handleResult(result);
    }, { delivery: ArtifactDelivery.Events, eventContext: context, methodName });
}
