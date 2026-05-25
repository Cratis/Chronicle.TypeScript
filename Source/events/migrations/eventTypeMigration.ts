// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { Constructor } from '@cratis/fundamentals';
import { getEventTypeFor } from '../eventTypeDecorator';
import { EventType } from '../EventType';
import { InvalidMigrationGenerationGap } from './InvalidMigrationGenerationGap';
import { DecoratorType, TypeDiscoverer } from '../../types';

const EVENT_TYPE_MIGRATION_METADATA_KEY = 'chronicle:eventTypeMigration';

/**
 * Metadata stored on an event type migration class.
 */
export interface EventTypeMigrationMetadata {
    /** The upgraded (newer) event type represented by this migration. */
    readonly eventType: EventType;

    /** The previous (older) event type this migration migrates from. */
    readonly previousEventType: EventType;
}

/**
 * Decorator that marks a class as an event type migration between two generations
 * of the same event type.
 * @param upgradedType - The upgraded event type constructor.
 * @param previousType - The previous event type constructor.
 * @returns A class decorator.
 */
export function eventTypeMigration(upgradedType: Constructor, previousType: Constructor): ClassDecorator {
    const upgradedEventType = getEventTypeFor(upgradedType);
    const previousEventType = getEventTypeFor(previousType);

    if (upgradedEventType.id.value === '') {
        throw new Error(`Type '${upgradedType.name}' must be decorated with @eventType().`);
    }
    if (previousEventType.id.value === '') {
        throw new Error(`Type '${previousType.name}' must be decorated with @eventType().`);
    }

    if (upgradedEventType.id.value !== previousEventType.id.value || upgradedEventType.generation.value !== previousEventType.generation.value + 1) {
        throw new InvalidMigrationGenerationGap(
            previousType.name,
            upgradedType.name,
            previousEventType.generation.value,
            upgradedEventType.generation.value
        );
    }

    return (target: object) => {
        const metadata: EventTypeMigrationMetadata = {
            eventType: upgradedEventType,
            previousEventType
        };

        Reflect.defineMetadata(EVENT_TYPE_MIGRATION_METADATA_KEY, metadata, target);
        TypeDiscoverer.default.register(
            DecoratorType.EventTypeMigration,
            target as Constructor,
            `${upgradedEventType.id.value}+${upgradedEventType.generation.value}`
        );
    };
}

/**
 * Gets the {@link EventTypeMigrationMetadata} associated with a class decorated with {@link eventTypeMigration}.
 * @param target - The class constructor to retrieve the metadata for.
 * @returns The associated metadata, or undefined if not decorated.
 */
export function getEventTypeMigrationMetadata(target: Function): EventTypeMigrationMetadata | undefined {
    return Reflect.getMetadata(EVENT_TYPE_MIGRATION_METADATA_KEY, target);
}

/**
 * Checks whether a class has been decorated with {@link eventTypeMigration}.
 * @param target - The class constructor to check.
 * @returns True if the class has migration metadata; false otherwise.
 */
export function isEventTypeMigration(target: Function): boolean {
    return Reflect.hasMetadata(EVENT_TYPE_MIGRATION_METADATA_KEY, target);
}
