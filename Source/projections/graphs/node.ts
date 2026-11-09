// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import type { Constructor } from '@cratis/fundamentals';
import { DecoratorType, TypeDiscoverer } from '../../types/index.js';
import type { ChronicleClassDecorator } from '../../types/standardDecoratorMetadata.js';

/** Metadata stored by the node class decorator. */
export interface NodeMetadata {
    /** The node label. */
    readonly label: string;
}

const METADATA_KEY = 'chronicle:graph:node';

/**
 * Class decorator that marks a class as a node in a property graph. The properties of the class are the
 * properties of the node, and the member with the graphKey decorator holds its unique key. Which events create,
 * update and remove nodes is declared with nodeFrom, nodeRemovedWith and the property mapping decorators.
 * @param label - The node label. Defaults to the name of the class.
 * @returns A class decorator.
 */
export function node(label?: string): ChronicleClassDecorator {
    return (target: object) => {
        const type = target as Function;
        const metadata: NodeMetadata = { label: label ?? type.name };
        Reflect.defineMetadata(METADATA_KEY, metadata, target);
        TypeDiscoverer.default.register(DecoratorType.GraphElement, type as Constructor);
    };
}

/**
 * Retrieves the metadata stored by the node decorator.
 * @param target - The class constructor.
 * @returns The metadata, or undefined when the class is not a node.
 */
export function getNodeMetadata(target: Function): NodeMetadata | undefined {
    return Reflect.getMetadata(METADATA_KEY, target) as NodeMetadata | undefined;
}
