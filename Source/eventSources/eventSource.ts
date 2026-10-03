// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import type { Constructor } from '@cratis/fundamentals';
import { DecoratorType, TypeDiscoverer } from '../types/index.js';
import type { ChronicleClassDecorator } from '../types/standardDecoratorMetadata.js';
import type { ConcurrencyDimensionFlags } from './ConcurrencyDimensions.js';

const EVENT_SOURCE_METADATA_KEY = 'chronicle:eventSource';
const EVENT_STREAMS_METADATA_KEY = 'chronicle:eventSource:streams';
let registrationCounter = 0;

/** Optional settings for {@link eventSource}. */
export interface EventSourceOptions {
    /** The stable name. Defaults to the class name without a trailing `EventSource`. */
    name?: string;

    /** The description of the event source. */
    description?: string;

    /** The default dimensions that take part in concurrency checks; combine {@link ConcurrencyDimensions} values with `|`. */
    concurrency?: ConcurrencyDimensionFlags;
}

/** Optional settings for {@link eventStream}. */
export interface EventStreamOptions {
    /** The description of the stream. */
    description?: string;

    /** The dimensions that take part in concurrency checks for the stream. Falls back to the event source when omitted or none. */
    concurrency?: ConcurrencyDimensionFlags;
}

/** Metadata recorded by {@link eventSource}. */
export interface EventSourceMetadata {
    readonly name: string;
    readonly description: string;
    readonly concurrency: ConcurrencyDimensionFlags;
}

/** Metadata recorded by {@link eventStream}. */
export interface EventStreamMetadata {
    readonly name: string;
    readonly description: string;
    readonly concurrency: ConcurrencyDimensionFlags;
}

/**
 * Declares a class as an event source definition, discovered and registered with the Kernel at startup.
 * The definition is not tied to event types; an append routes through it with `AppendOptions.eventSource`.
 * Supports legacy and standard class decorators.
 * @param options - Optional name (defaults to the class name without a trailing `EventSource`), description and concurrency.
 * @returns A class decorator.
 */
export function eventSource(options?: EventSourceOptions): ChronicleClassDecorator {
    return ((target: Function, context?: ClassDecoratorContext) => {
        let constructor = target;
        const metadata: EventSourceMetadata = {
            name: options?.name ?? defaultNameFor(constructor),
            description: options?.description ?? '',
            concurrency: options?.concurrency ?? 0
        };
        Reflect.defineMetadata(EVENT_SOURCE_METADATA_KEY, metadata, target);
        TypeDiscoverer.default.register(DecoratorType.EventSource, constructor as Constructor, `${metadata.name}#${registrationCounter++}`);
        context?.addInitializer(function () {
            if (this !== constructor) {
                constructor = this as Function;
                Reflect.defineMetadata(EVENT_SOURCE_METADATA_KEY, metadata, constructor);
                Reflect.defineMetadata(EVENT_STREAMS_METADATA_KEY, Reflect.getOwnMetadata(EVENT_STREAMS_METADATA_KEY, target), constructor);
                TypeDiscoverer.default.register(DecoratorType.EventSource, constructor as Constructor, `${metadata.name}#${registrationCounter++}`);
            }
        });
    }) as ChronicleClassDecorator;
}

/**
 * Declares a stream of an event source. Repeat the decorator for several streams.
 * Only takes effect on a class that is also decorated with {@link eventSource}.
 * @param name - The stable name of the stream, which is the event stream type of appended events.
 * @param options - Optional description and concurrency dimensions.
 * @returns A class decorator.
 */
export function eventStream(name: string, options?: EventStreamOptions): ChronicleClassDecorator {
    return ((target: Function) => {
        const existing = (Reflect.getOwnMetadata(EVENT_STREAMS_METADATA_KEY, target) as EventStreamMetadata[] | undefined) ?? [];
        // Decorators evaluate bottom-up; unshift keeps declaration order.
        Reflect.defineMetadata(EVENT_STREAMS_METADATA_KEY, [
            { name, description: options?.description ?? '', concurrency: options?.concurrency ?? 0 },
            ...existing
        ], target);
    }) as ChronicleClassDecorator;
}

/**
 * Gets the event source metadata declared on a class.
 * @param target - The class constructor.
 * @returns The metadata, or undefined when the class is not an event source.
 */
export function getEventSourceMetadata(target: Function): EventSourceMetadata | undefined {
    return Reflect.getOwnMetadata(EVENT_SOURCE_METADATA_KEY, target) as EventSourceMetadata | undefined;
}

/**
 * Gets the streams declared on a class, in declaration order (duplicates are preserved so they can be rejected).
 * @param target - The class constructor.
 * @returns The declared streams.
 */
export function getEventStreamsFor(target: Function): ReadonlyArray<EventStreamMetadata> {
    return (Reflect.getOwnMetadata(EVENT_STREAMS_METADATA_KEY, target) as EventStreamMetadata[] | undefined) ?? [];
}

function defaultNameFor(type: Function): string {
    const suffix = 'EventSource';
    return type.name.length > suffix.length && type.name.endsWith(suffix) ? type.name.slice(0, -suffix.length) : type.name;
}
