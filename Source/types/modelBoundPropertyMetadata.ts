// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { getStandardMetadata, hasOwnStandardMetadata } from './standardDecoratorMetadata.js';

// The standard field decorator has no constructor, but its metadata object is attached to
// the declaring class after evaluation. Discovery can match that object to a module export.
const mappedMetadata = new WeakMap<object, Set<string>>();
const pendingMetadata = new Set<WeakRef<object>>();
const finalizedMetadata = new FinalizationRegistry<WeakRef<object>>(reference => pendingMetadata.delete(reference));

export const modelBoundPropertyKeys = [
    'setFrom', 'setFromContext', 'setValue', 'addFrom', 'subtractFrom',
    'increment', 'decrement', 'count', 'childrenFrom', 'join', 'fromEvery', 'fromAll'
].map(name => `chronicle:projection:${name}`);

/** Records a standard-decorated class with an event mapping on one of its fields. */
export function trackModelBoundMetadata(metadata: object, property: string): void {
    if (!modelBoundPropertyKeys.some(key => Reflect.hasOwnMetadata(key, metadata, property))) return;
    let properties = mappedMetadata.get(metadata);
    if (!properties) {
        properties = new Set<string>();
        mappedMetadata.set(metadata, properties);
        const reference = new WeakRef(metadata);
        pendingMetadata.add(reference);
        finalizedMetadata.register(metadata, reference, reference);
    }
    properties.add(property);
}

/** Whether a class's standard decorator metadata contains a mapped property. */
export function hasModelBoundMetadata(metadata: object): boolean {
    return mappedMetadata.has(metadata);
}

/** Returns each unresolved mapping once, dropping resolved and collected metadata from the registry. */
export function takeUnregisteredModelBoundMappings(registeredTypes: Function[]): string[] {
    const registeredMetadata = new Set(registeredTypes.filter(hasOwnStandardMetadata).map(getStandardMetadata));
    const unmapped: string[] = [];
    for (const reference of pendingMetadata) {
        const metadata = reference.deref();
        pendingMetadata.delete(reference);
        finalizedMetadata.unregister(reference);
        if (!metadata || registeredMetadata.has(metadata)) continue;
        for (const property of mappedMetadata.get(metadata) ?? []) {
            for (const key of modelBoundPropertyKeys) {
                const value = Reflect.getOwnMetadata(key, metadata, property) as unknown;
                if (value === undefined) continue;
                const mappings: unknown[] = Array.isArray(value) ? value : [value];
                for (const mapping of mappings) {
                    const eventType = mapping && typeof mapping === 'object' && 'eventType' in mapping ? mapping.eventType : undefined;
                    const eventName = typeof eventType === 'function' ? eventType.name : 'all events';
                    unmapped.push(`${property} <- ${eventName}`);
                }
            }
        }
    }
    return [...new Set(unmapped)];
}
