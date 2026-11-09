// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import type { ChronicleClassDecorator } from '../../types/standardDecoratorMetadata.js';

/** Options for the edgeFrom class decorator. */
export interface EdgeFromOptions {
    /** The name of the event property that holds the key of the source node. */
    readonly sourceKey: string;

    /** The name of the event property that holds the key of the target node. */
    readonly targetKey: string;

    /** The name of the event property that holds the identity of the edge, for an edge type with an identifying property. */
    readonly identity?: string;
}

/** Metadata stored by the edgeFrom class decorator. */
export interface EdgeFromMetadata extends EdgeFromOptions {
    /** The event constructor. */
    readonly eventType: Function;
}

const METADATA_KEY = 'chronicle:graph:edgeFrom';

/**
 * Class decorator that creates or updates an edge when an event is observed. Both end nodes are created without
 * properties when they do not exist.
 * @param eventType - The event constructor.
 * @param options - The event properties that hold the keys of the end nodes and, optionally, the identity of the edge.
 * @returns A class decorator.
 */
export function edgeFrom(eventType: Function, options: EdgeFromOptions): ChronicleClassDecorator {
    return (target: object) => {
        const existing: EdgeFromMetadata[] = Reflect.getMetadata(METADATA_KEY, target) ?? [];
        Reflect.defineMetadata(METADATA_KEY, [...existing, { eventType, ...options }], target);
    };
}

/**
 * Retrieves all edgeFrom metadata stored on the given class constructor.
 * @param target - The class constructor.
 * @returns An array of edgeFrom metadata entries.
 */
export function getEdgeFromMetadata(target: Function): EdgeFromMetadata[] {
    return Reflect.getMetadata(METADATA_KEY, target) ?? [];
}
