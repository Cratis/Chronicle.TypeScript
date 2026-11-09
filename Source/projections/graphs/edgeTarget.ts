// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { TypeIntrospector } from '../../types/index.js';
import { ChroniclePropertyDecorator, decorateProperty, getPropertyMetadata } from '../../types/propertyDecoratorMetadata.js';

/** Metadata stored by the edgeTarget property decorator. */
export interface EdgeTargetMetadata {
    /** The type of the node. */
    readonly nodeType: Function;
}

const METADATA_KEY = 'chronicle:graph:edgeTarget';

/**
 * Property decorator that marks the member of an edge that holds the key of the node the edge ends at.
 * The member is not a property of the edge.
 * @param nodeType - The type of the node.
 * @returns A property decorator.
 */
export function edgeTarget(nodeType: Function): ChroniclePropertyDecorator {
    return decorateProperty((target: object, propertyKey: string | symbol) => {
        const key = propertyKey.toString();
        TypeIntrospector.trackProperty((target as { constructor: Function }).constructor, key);
        const metadata: EdgeTargetMetadata = { nodeType };
        Reflect.defineMetadata(METADATA_KEY, metadata, target, key);
    });
}

/**
 * Retrieves the metadata stored by the edgeTarget decorator on a property.
 * @param target - The class prototype.
 * @param propertyKey - The property name.
 * @returns The metadata, or undefined when the property is not marked.
 */
export function getEdgeTargetMetadata(target: object, propertyKey: string): EdgeTargetMetadata | undefined {
    return getPropertyMetadata<EdgeTargetMetadata>(METADATA_KEY, target, propertyKey);
}
