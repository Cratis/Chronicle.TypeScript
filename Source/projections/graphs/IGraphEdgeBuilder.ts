// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Constructor, PropertyAccessor } from '@cratis/fundamentals';
import type { IGraphEdgeFromBuilder } from './IGraphEdgeFromBuilder.js';
import type { IGraphEdgeRemovedWithBuilder } from './IGraphEdgeRemovedWithBuilder.js';

/**
 * Defines a builder for an edge.
 * @template TEdge - The type of edge.
 */
export interface IGraphEdgeBuilder<TEdge> {
    /**
     * Names the edge type. Not needed when the class of the edge has the edge decorator.
     * @param type - The edge type, for example MEMBER_OF.
     * @returns The builder for continuation.
     */
    named(type: string): IGraphEdgeBuilder<TEdge>;

    /**
     * Declares the property that identifies the edge among edges of the same type between the same two nodes.
     * Not needed when the property has the graphKey decorator.
     * @param identityAccessor - Accessor for the identifying property.
     * @returns The builder for continuation.
     */
    identifiedBy(identityAccessor: PropertyAccessor<TEdge>): IGraphEdgeBuilder<TEdge>;

    /**
     * Creates or updates the edge when an event is observed. Both end nodes are created when they do not exist.
     * @param eventType - The event constructor.
     * @param configure - Callback for the keys of the end nodes and the properties.
     * @returns The builder for continuation.
     */
    from<TEvent>(eventType: Constructor<TEvent>, configure: (builder: IGraphEdgeFromBuilder<TEdge, TEvent>) => void): IGraphEdgeBuilder<TEdge>;

    /**
     * Deletes the edge when an event is observed. The nodes at both ends stay.
     * @param eventType - The event constructor.
     * @param configure - Callback for the keys of the end nodes.
     * @returns The builder for continuation.
     */
    removedWith<TEvent>(eventType: Constructor<TEvent>, configure: (builder: IGraphEdgeRemovedWithBuilder<TEvent>) => void): IGraphEdgeBuilder<TEdge>;
}
