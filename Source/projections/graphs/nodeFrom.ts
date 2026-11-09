// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import type { ChronicleClassDecorator } from '../../types/standardDecoratorMetadata.js';

/** Options for the nodeFrom class decorator. */
export interface NodeFromOptions {
    /** The name of the event property that holds the key of the node. Defaults to the event source id. */
    readonly key?: string;

    /** A constant key. Every event then updates the same node. */
    readonly constantKey?: string;

    /** Only set properties on a node that already exists, instead of creating it. */
    readonly updateOnly?: boolean;
}

/** Metadata stored by the nodeFrom class decorator. */
export interface NodeFromMetadata extends NodeFromOptions {
    /** The event constructor. */
    readonly eventType: Function;
}

const METADATA_KEY = 'chronicle:graph:nodeFrom';

/**
 * Class decorator that creates or updates a node when an event is observed. Properties of the node are mapped by
 * name from an event property of the same name, or explicitly with the property mapping decorators.
 * @param eventType - The event constructor.
 * @param options - Optional key and update-only configuration.
 * @returns A class decorator.
 */
export function nodeFrom(eventType: Function, options?: NodeFromOptions): ChronicleClassDecorator {
    return (target: object) => {
        const existing: NodeFromMetadata[] = Reflect.getMetadata(METADATA_KEY, target) ?? [];
        Reflect.defineMetadata(METADATA_KEY, [...existing, { eventType, ...options }], target);
    };
}

/**
 * Retrieves all nodeFrom metadata stored on the given class constructor.
 * @param target - The class constructor.
 * @returns An array of nodeFrom metadata entries.
 */
export function getNodeFromMetadata(target: Function): NodeFromMetadata[] {
    return Reflect.getMetadata(METADATA_KEY, target) ?? [];
}
