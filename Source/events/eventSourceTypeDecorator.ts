// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';

const EVENT_SOURCE_TYPE_METADATA_KEY = 'chronicle:eventSourceType';

/**
 * Restricts a reactor or reducer to events from the given event source type.
 * Like .NET `[EventSourceType]`, also sets the source type of bare events returned by a reactor when non-empty.
 * Explicit EventForEventSourceId returns and service append options retain their own metadata.
 * Does not filter projections.
 * Supports legacy and standard class decorators; derived observers inherit the value unless overridden.
 * @param value - The event source type to observe. An empty string leaves the source type unrestricted.
 * @returns A class decorator.
 */
export function eventSourceType(value: string): ClassDecorator {
    return (target: object) => { Reflect.defineMetadata(EVENT_SOURCE_TYPE_METADATA_KEY, value, target); };
}

/**
 * Resolves an observer's event source type filter, including inherited metadata.
 * @param target - The observer constructor.
 * @returns The configured value, or an empty string (unspecified).
 */
export function getEventSourceTypeFor(target: Function): string {
    return (Reflect.getMetadata(EVENT_SOURCE_TYPE_METADATA_KEY, target) as string | undefined) ?? '';
}
