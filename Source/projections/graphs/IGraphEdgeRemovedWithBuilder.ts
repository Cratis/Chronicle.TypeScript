// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { PropertyAccessor } from '@cratis/fundamentals';

/**
 * Defines the builder for how an event deletes an edge.
 * @template TEvent - The type of event.
 */
export interface IGraphEdgeRemovedWithBuilder<TEvent> {
    /**
     * Takes the key of the source node from a property on the event. By default it is the event source id.
     * @param keyAccessor - Accessor for the event property.
     * @returns The builder for continuation.
     */
    usingSourceKey(keyAccessor: PropertyAccessor<TEvent>): IGraphEdgeRemovedWithBuilder<TEvent>;

    /**
     * Takes the key of the target node from a property on the event. By default it is the event source id.
     * @param keyAccessor - Accessor for the event property.
     * @returns The builder for continuation.
     */
    usingTargetKey(keyAccessor: PropertyAccessor<TEvent>): IGraphEdgeRemovedWithBuilder<TEvent>;

    /**
     * Takes the identity of the edge from a property on the event, for an edge type with an identifying property.
     * By default it is the event property named like the identifying property.
     * @param identityAccessor - Accessor for the event property.
     * @returns The builder for continuation.
     */
    usingIdentity(identityAccessor: PropertyAccessor<TEvent>): IGraphEdgeRemovedWithBuilder<TEvent>;
}
