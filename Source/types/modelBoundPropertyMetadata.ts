// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';

// The standard field decorator has no constructor, but its metadata object is attached to
// the declaring class after evaluation. Discovery can match that object to a module export.
const mappedMetadata = new WeakSet<object>();

export const modelBoundPropertyKeys = [
    'setFrom', 'setFromContext', 'setValue', 'addFrom', 'subtractFrom',
    'increment', 'decrement', 'count', 'childrenFrom', 'join', 'fromEvery', 'fromAll'
].map(name => `chronicle:projection:${name}`);

/** Records a standard-decorated class with an event mapping on one of its fields. */
export function trackModelBoundMetadata(metadata: object, property: string): void {
    if (modelBoundPropertyKeys.some(key => Reflect.hasOwnMetadata(key, metadata, property))) {
        mappedMetadata.add(metadata);
    }
}

/** Whether a class's standard decorator metadata contains a mapped property. */
export function hasModelBoundMetadata(metadata: object): boolean {
    return mappedMetadata.has(metadata);
}
