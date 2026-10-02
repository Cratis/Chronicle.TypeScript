// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';

const EVENT_STREAM_TYPE_METADATA_KEY = 'chronicle:eventStreamType';

/**
 * Restricts a reactor or reducer to events in the given event stream type.
 * Equivalent to the .NET `[EventStreamType]` attribute on an observer.
 * This does not set metadata on appended events or filter projections.
 * Supports legacy and standard class decorators; derived observers inherit the value unless overridden.
 * @param value - The event stream type to observe. 'All' leaves the stream type unrestricted.
 * @returns A class decorator.
 */
export function eventStreamType(value: string): ClassDecorator {
    return (target: object) => { Reflect.defineMetadata(EVENT_STREAM_TYPE_METADATA_KEY, value, target); };
}

/**
 * Resolves an observer's event stream type filter, including inherited metadata.
 * @param target - The observer constructor.
 * @returns The configured value, or 'All' (unrestricted).
 */
export function getEventStreamTypeFor(target: Function): string {
    return (Reflect.getMetadata(EVENT_STREAM_TYPE_METADATA_KEY, target) as string | undefined) ?? 'All';
}
