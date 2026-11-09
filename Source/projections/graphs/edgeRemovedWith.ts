// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import type { ChronicleClassDecorator } from '../../types/standardDecoratorMetadata.js';
import type { EdgeFromOptions } from './edgeFrom.js';

/** Metadata stored by the edgeRemovedWith class decorator. */
export interface EdgeRemovedWithMetadata extends EdgeFromOptions {
    /** The event constructor. */
    readonly eventType: Function;
}

const METADATA_KEY = 'chronicle:graph:edgeRemovedWith';

/**
 * Class decorator that deletes an edge when an event is observed. The nodes at both ends stay.
 * @param eventType - The event constructor.
 * @param options - The event properties that hold the keys of the end nodes and, optionally, the identity of the edge.
 * @returns A class decorator.
 */
export function edgeRemovedWith(eventType: Function, options: EdgeFromOptions): ChronicleClassDecorator {
    return (target: object) => {
        const existing: EdgeRemovedWithMetadata[] = Reflect.getMetadata(METADATA_KEY, target) ?? [];
        Reflect.defineMetadata(METADATA_KEY, [...existing, { eventType, ...options }], target);
    };
}

/**
 * Retrieves all edgeRemovedWith metadata stored on the given class constructor.
 * @param target - The class constructor.
 * @returns An array of edgeRemovedWith metadata entries.
 */
export function getEdgeRemovedWithMetadata(target: Function): EdgeRemovedWithMetadata[] {
    return Reflect.getMetadata(METADATA_KEY, target) ?? [];
}
