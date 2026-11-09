// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Constructor } from '@cratis/fundamentals';
import type { PropertyAccessor } from '@cratis/fundamentals';
import type { IGraphNodeFromBuilder } from './IGraphNodeFromBuilder.js';
import type { IGraphNodeRemovedWithBuilder } from './IGraphNodeRemovedWithBuilder.js';

/**
 * Defines a builder for a node.
 * @template TNode - The type of node.
 */
export interface IGraphNodeBuilder<TNode> {
    /**
     * Declares the property that holds the unique key of the node. Not needed when the property has the graphKey decorator.
     * @param keyAccessor - Accessor for the key property.
     * @returns The builder for continuation.
     */
    identifiedBy(keyAccessor: PropertyAccessor<TNode>): IGraphNodeBuilder<TNode>;

    /**
     * Creates or updates the node when an event is observed.
     * @param eventType - The event constructor.
     * @param configure - Optional callback for the key and the properties. By default the key is the event source id
     * and properties are mapped by name.
     * @returns The builder for continuation.
     */
    from<TEvent>(eventType: Constructor<TEvent>, configure?: (builder: IGraphNodeFromBuilder<TNode, TEvent>) => void): IGraphNodeBuilder<TNode>;

    /**
     * Deletes the node when an event is observed.
     * @param eventType - The event constructor.
     * @param configure - Optional callback for the key and for detaching. By default the key is the event source id.
     * @returns The builder for continuation.
     */
    removedWith<TEvent>(eventType: Constructor<TEvent>, configure?: (builder: IGraphNodeRemovedWithBuilder<TEvent>) => void): IGraphNodeBuilder<TNode>;
}
