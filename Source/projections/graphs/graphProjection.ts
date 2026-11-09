// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import type { Constructor } from '@cratis/fundamentals';
import { DecoratorType, TypeDiscoverer } from '../../types/index.js';
import type { ChronicleClassDecorator } from '../../types/standardDecoratorMetadata.js';

/** Metadata stored by the graphProjection class decorator. */
export interface GraphProjectionMetadata {
    /** The name of the graph. */
    readonly name: string;
}

const METADATA_KEY = 'chronicle:graph:projection';

/**
 * Class decorator that marks a class implementing IGraphProjection as a graph projection, declared with a fluent builder.
 * @param name - The name of the graph, which is also the name of the read model the graph is registered as.
 * Defaults to the name of the class.
 * @returns A class decorator.
 */
export function graphProjection(name?: string): ChronicleClassDecorator {
    return (target: object) => {
        const type = target as Function;
        const metadata: GraphProjectionMetadata = { name: name ?? type.name };
        Reflect.defineMetadata(METADATA_KEY, metadata, target);
        TypeDiscoverer.default.register(DecoratorType.GraphProjection, type as Constructor);
    };
}

/**
 * Retrieves the metadata stored by the graphProjection decorator.
 * @param target - The class constructor.
 * @returns The metadata, or undefined when the class is not a graph projection.
 */
export function getGraphProjectionMetadata(target: Function): GraphProjectionMetadata | undefined {
    return Reflect.getMetadata(METADATA_KEY, target) as GraphProjectionMetadata | undefined;
}
