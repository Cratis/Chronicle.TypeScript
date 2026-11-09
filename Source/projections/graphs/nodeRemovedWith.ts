// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import type { ChronicleClassDecorator } from '../../types/standardDecoratorMetadata.js';

/** Options for the nodeRemovedWith class decorator. */
export interface NodeRemovedWithOptions {
    /** The name of the event property that holds the key of the node. Defaults to the event source id. */
    readonly key?: string;

    /** Delete the edges attached to the node with it. Without it a node that still has edges cannot be deleted. */
    readonly detach?: boolean;
}

/** Metadata stored by the nodeRemovedWith class decorator. */
export interface NodeRemovedWithMetadata extends NodeRemovedWithOptions {
    /** The event constructor. */
    readonly eventType: Function;
}

const METADATA_KEY = 'chronicle:graph:nodeRemovedWith';

/**
 * Class decorator that deletes a node when an event is observed.
 * @param eventType - The event constructor.
 * @param options - Optional key and detach configuration.
 * @returns A class decorator.
 */
export function nodeRemovedWith(eventType: Function, options?: NodeRemovedWithOptions): ChronicleClassDecorator {
    return (target: object) => {
        const existing: NodeRemovedWithMetadata[] = Reflect.getMetadata(METADATA_KEY, target) ?? [];
        Reflect.defineMetadata(METADATA_KEY, [...existing, { eventType, ...options }], target);
    };
}

/**
 * Retrieves all nodeRemovedWith metadata stored on the given class constructor.
 * @param target - The class constructor.
 * @returns An array of nodeRemovedWith metadata entries.
 */
export function getNodeRemovedWithMetadata(target: Function): NodeRemovedWithMetadata[] {
    return Reflect.getMetadata(METADATA_KEY, target) ?? [];
}
