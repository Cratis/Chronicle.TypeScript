// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { PropertyAccessor } from '@cratis/fundamentals';

/**
 * Defines the builder for how an event deletes a node.
 * @template TEvent - The type of event.
 */
export interface IGraphNodeRemovedWithBuilder<TEvent> {
    /**
     * Takes the key of the node from a property on the event. By default it is the event source id.
     * @param keyAccessor - Accessor for the event property.
     * @returns The builder for continuation.
     */
    usingKey(keyAccessor: PropertyAccessor<TEvent>): IGraphNodeRemovedWithBuilder<TEvent>;

    /**
     * Deletes the edges attached to the node with it. Without it a node that still has edges cannot be deleted.
     * @returns The builder for continuation.
     */
    detach(): IGraphNodeRemovedWithBuilder<TEvent>;
}
