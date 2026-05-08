// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { EventType } from './EventType';
import { EventTypeId } from './EventTypeId';
import { EventTypeGeneration } from './EventTypeGeneration';
import { DecoratorType, DiscoverableType, TypeDiscoverer } from '../TypeDiscovery';

/** Metadata key used to store event type information on a class. */
const EVENT_TYPE_METADATA_KEY = 'chronicle:eventType';

/**
 * TypeScript decorator that marks a class as an event type and associates it with a specific
 * {@link EventType} identifier and generation. This is the TypeScript equivalent of the
 * C# `[EventType]` attribute.
 *
 * @param id - The unique identifier for the event type. Defaults to an empty string.
 * @param generation - The generation number for the event type. Defaults to 1.
 * @returns A class decorator.
 *
 * @example
 * ```typescript
 * @eventType('aa7faa25-afc1-48d1-8558-716581c0e916', 1)
 * class EmployeeHired {
 *     constructor(readonly firstName: string, readonly lastName: string) {}
 * }
 * ```
 */
export function eventType(id: string = '', generation: number = EventTypeGeneration.firstValue): ClassDecorator {
    return (target: object) => {
        const constructor = target as Function;
        const eventTypeId = new EventTypeId(id || constructor.name);
        const eventTypeInstance = new EventType(eventTypeId, new EventTypeGeneration(generation));
        Reflect.defineMetadata(EVENT_TYPE_METADATA_KEY, eventTypeInstance, target);
        TypeDiscoverer.default.register(
            DecoratorType.EventType,
            constructor as DiscoverableType,
            eventTypeId.value
        );
    };
}

/**
 * Gets the {@link EventType} associated with a class decorated with {@link eventType}.
 * @param target - The class constructor to retrieve the event type for.
 * @returns The associated EventType, or EventType.unknown if not decorated.
 */
export function getEventTypeFor(target: Function): EventType {
    return Reflect.getMetadata(EVENT_TYPE_METADATA_KEY, target) ?? EventType.unknown;
}

/**
 * Checks whether a class has been decorated with {@link eventType}.
 * @param target - The class constructor to check.
 * @returns True if the class has an event type decorator; false otherwise.
 */
export function hasEventType(target: Function): boolean {
    return Reflect.hasMetadata(EVENT_TYPE_METADATA_KEY, target);
}
