// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { IGraphProjectionBuilder } from './IGraphProjectionBuilder.js';

/**
 * Defines a projection of events onto a property graph, declared with a fluent builder.
 * Implement it on a class decorated with graphProjection.
 */
export interface IGraphProjection {
    /**
     * Defines the nodes and edges of the graph and the events they are projected from.
     * @param builder - The builder to define with.
     */
    define(builder: IGraphProjectionBuilder): void;
}
