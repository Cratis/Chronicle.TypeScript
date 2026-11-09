// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import type { ChronicleClassDecorator } from '../../types/standardDecoratorMetadata.js';

const METADATA_KEY = 'chronicle:graph';

/**
 * Class decorator that names the graph a node, an edge or a graph projection belongs to.
 * All the nodes and edges that name the same graph are registered as one graph.
 * @param name - The name of the graph. It is also the name of the read model the graph is registered as.
 * @returns A class decorator.
 */
export function graph(name: string): ChronicleClassDecorator {
    return (target: object) => {
        Reflect.defineMetadata(METADATA_KEY, name, target);
    };
}

/**
 * Retrieves the graph name stored by the graph decorator.
 * @param target - The class constructor.
 * @returns The name of the graph, or undefined when the type does not name one.
 */
export function getGraphName(target: Function): string | undefined {
    return Reflect.getMetadata(METADATA_KEY, target) as string | undefined;
}
