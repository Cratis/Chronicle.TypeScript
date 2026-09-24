// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { Constructor } from '@cratis/fundamentals';
import { EventType } from './EventType.js';
import { EventTypeId } from './EventTypeId.js';
import { EventTypeGeneration } from './EventTypeGeneration.js';
import { DecoratorType, TypeDiscoverer, TypeIntrospector } from '../types/index.js';
import { JsonSchema, JsonSchemaGenerator } from '../schemas/index.js';
import { ChronicleClassDecorator } from '../types/standardDecoratorMetadata.js';
import { createDeferredSchema } from '../schemas/createDeferredSchema.js';

/** Metadata key used to store event type information on a class. */
const EVENT_TYPE_METADATA_KEY = 'chronicle:eventType';

/**
 * Metadata stored for an event type class.
 */
export interface EventTypeMetadata {
    /** The event type descriptor for the event class. */
    readonly eventType: EventType;

    /** The reflected members and their runtime types. */
    readonly members: ReadonlyMap<string, Function | undefined>;

    /** The generated schema for the event class. */
    readonly schema: JsonSchema;
}

/**
 * TypeScript decorator that marks a class as an event type and associates it with a specific
 * {@link EventType} identifier and generation. This is the TypeScript equivalent of the
 * C# `[EventType]` attribute.
 *
 * Overloads:
 * - `@eventType()` -> uses class name as id, generation 1, tombstone false.
 * - `@eventType(generation)` -> uses class name as id and provided generation.
 * - `@eventType(tombstone)` -> uses class name as id/generation and provided tombstone.
 * - `@eventType(generation, tombstone)` -> uses class name as id.
 * - `@eventType(id, generation, tombstone)` -> full explicit form.
 *
 * @param idOrGenerationOrTombstone - Optional id, generation, or tombstone based on overload.
 * @param generationOrTombstone - Optional generation or tombstone based on overload.
 * @param tombstone - Optional explicit tombstone for the explicit id overload.
 * @returns A class decorator.
 *
 * @example
 * ```typescript
 * @eventType()
 * class EmployeeHired {
 *     @field(String) firstName: string;
 *     @field(String) lastName: string;
 *     constructor(firstName: string, lastName: string) {
 *         this.firstName = firstName;
 *         this.lastName = lastName;
 *     }
 * }
 * ```
 */
export function eventType(): ChronicleClassDecorator;
export function eventType(id: string): ChronicleClassDecorator;
export function eventType(id: string, generation: number): ChronicleClassDecorator;
export function eventType(id: string, generation: number, tombstone: boolean): ChronicleClassDecorator;
export function eventType(generation: number): ChronicleClassDecorator;
export function eventType(generation: number, tombstone: boolean): ChronicleClassDecorator;
export function eventType(tombstone: boolean): ChronicleClassDecorator;
export function eventType(
    idOrGenerationOrTombstone?: string | number | boolean,
    generationOrTombstone?: number | boolean,
    tombstone: boolean = false
): ChronicleClassDecorator {
    let id = '';
    let generation = EventTypeGeneration.firstValue;
    let isTombstone = false;

    if (typeof idOrGenerationOrTombstone === 'string') {
        id = idOrGenerationOrTombstone;
        if (typeof generationOrTombstone === 'number') {
            generation = generationOrTombstone;
        }
        if (typeof generationOrTombstone === 'boolean') {
            isTombstone = generationOrTombstone;
        } else {
            isTombstone = tombstone;
        }
    } else if (typeof idOrGenerationOrTombstone === 'number') {
        generation = idOrGenerationOrTombstone;
        if (typeof generationOrTombstone === 'boolean') {
            isTombstone = generationOrTombstone;
        }
    } else if (typeof idOrGenerationOrTombstone === 'boolean') {
        isTombstone = idOrGenerationOrTombstone;
    }

    return (target: object, context?: ClassDecoratorContext) => {
        let constructor = target as Function;
        const eventTypeId = new EventTypeId(id || constructor.name);
        const eventTypeInstance = new EventType(eventTypeId, new EventTypeGeneration(generation), isTombstone);
        const members = context?.kind === 'class' ? undefined : TypeIntrospector.getMembers(constructor);
        const resolve = createDeferredSchema(() => constructor);
        const metadata: EventTypeMetadata = context?.kind === 'class' ? {
            eventType: eventTypeInstance,
            get members() {
                return resolve().members;
            },
            get schema() {
                return resolve().schema;
            }
        } : {
            eventType: eventTypeInstance,
            members: members!,
            schema: JsonSchemaGenerator.generate(constructor, members)
        };
        Reflect.defineMetadata(EVENT_TYPE_METADATA_KEY, metadata, target);
        TypeDiscoverer.default.register(
            DecoratorType.EventType,
            constructor as Constructor,
            eventTypeId.value
        );
        context?.addInitializer(function () {
            if (this !== constructor) {
                constructor = this;
                Reflect.defineMetadata(EVENT_TYPE_METADATA_KEY, metadata, constructor);
                TypeDiscoverer.default.register(DecoratorType.EventType, constructor as Constructor, eventTypeId.value);
            }
        });
    };
}

/**
 * Gets the {@link EventType} associated with a class decorated with {@link eventType}.
 * @param target - The class constructor to retrieve the event type for.
 * @returns The associated EventType, or EventType.unknown if not decorated.
 */
export function getEventTypeFor(target: Function): EventType {
    return getEventTypeMetadata(target)?.eventType ?? EventType.unknown;
}

/**
 * Checks whether a class has been decorated with {@link eventType}.
 * @param target - The class constructor to check.
 * @returns True if the class has an event type decorator; false otherwise.
 */
export function hasEventType(target: Function): boolean {
    return getEventTypeMetadata(target) !== undefined;
}

/**
 * Gets the metadata associated with a class decorated with {@link eventType}.
 * @param target - The class constructor to retrieve metadata for.
 * @returns The associated metadata, or undefined if not decorated.
 */
export function getEventTypeMetadata(target: Function): EventTypeMetadata | undefined {
    return Reflect.getMetadata(EVENT_TYPE_METADATA_KEY, target);
}

/**
 * Generates a JSON schema for the provided event type class.
 * @param target - The event class constructor to generate schema for.
 * @returns The generated JSON schema.
 */
export function getEventTypeJsonSchemaFor(target: Function): JsonSchema {
    const metadata = getEventTypeMetadata(target);
    if (metadata) {
        return metadata.schema;
    }

    return JsonSchemaGenerator.createEmptySchema(target.name);
}
