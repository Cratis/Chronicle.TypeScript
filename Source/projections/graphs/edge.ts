// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import type { Constructor } from '@cratis/fundamentals';
import { DecoratorType, TypeDiscoverer } from '../../types/index.js';
import type { ChronicleClassDecorator } from '../../types/standardDecoratorMetadata.js';

/** Metadata stored by the edge class decorator. */
export interface EdgeMetadata {
    /** The edge type, for example MEMBER_OF. */
    readonly type: string;
}

const METADATA_KEY = 'chronicle:graph:edge';

/**
 * Class decorator that marks a class as an edge in a property graph. The members marked with edgeSource and
 * edgeTarget hold the keys of the nodes at both ends and are not properties of the edge. An edge is identified by its
 * type, source and target. Give a member the graphKey decorator to identify it by that property as well, which allows
 * more than one edge of the type between the same two nodes.
 * @param type - The edge type, for example MEMBER_OF.
 * @returns A class decorator.
 */
export function edge(type: string): ChronicleClassDecorator {
    return (target: object) => {
        const metadata: EdgeMetadata = { type };
        Reflect.defineMetadata(METADATA_KEY, metadata, target);
        TypeDiscoverer.default.register(DecoratorType.GraphElement, target as Constructor);
    };
}

/**
 * Retrieves the metadata stored by the edge decorator.
 * @param target - The class constructor.
 * @returns The metadata, or undefined when the class is not an edge.
 */
export function getEdgeMetadata(target: Function): EdgeMetadata | undefined {
    return Reflect.getMetadata(METADATA_KEY, target) as EdgeMetadata | undefined;
}
