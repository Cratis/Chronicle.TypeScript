// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { TypeIntrospector } from '../../types/index.js';
import { ChroniclePropertyDecorator, decorateProperty, getPropertyMetadata } from '../../types/propertyDecoratorMetadata.js';

/** Metadata stored by the edgeSource property decorator. */
export interface EdgeSourceMetadata {
    /** The type of the node. */
    readonly nodeType: Function;
}

const METADATA_KEY = 'chronicle:graph:edgeSource';

/**
 * Property decorator that marks the member of an edge that holds the key of the node the edge starts at.
 * The member is not a property of the edge.
 * @param nodeType - The type of the node.
 * @returns A property decorator.
 */
export function edgeSource(nodeType: Function): ChroniclePropertyDecorator {
    return decorateProperty((target: object, propertyKey: string | symbol) => {
        const key = propertyKey.toString();
        TypeIntrospector.trackProperty((target as { constructor: Function }).constructor, key);
        const metadata: EdgeSourceMetadata = { nodeType };
        Reflect.defineMetadata(METADATA_KEY, metadata, target, key);
    });
}

/**
 * Retrieves the metadata stored by the edgeSource decorator on a property.
 * @param target - The class prototype.
 * @param propertyKey - The property name.
 * @returns The metadata, or undefined when the property is not marked.
 */
export function getEdgeSourceMetadata(target: object, propertyKey: string): EdgeSourceMetadata | undefined {
    return getPropertyMetadata<EdgeSourceMetadata>(METADATA_KEY, target, propertyKey);
}
