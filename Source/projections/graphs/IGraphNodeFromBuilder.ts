// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { PropertyAccessor } from '@cratis/fundamentals';
import type { IGraphMappingBuilder } from './IGraphMappingBuilder.js';

/**
 * Defines the builder for how an event creates or updates a node.
 * @template TNode - The type of node.
 * @template TEvent - The type of event.
 */
export interface IGraphNodeFromBuilder<TNode, TEvent> extends IGraphMappingBuilder<TNode, TEvent, IGraphNodeFromBuilder<TNode, TEvent>> {
    /**
     * Takes the key of the node from a property on the event. By default it is the event source id.
     * @param keyAccessor - Accessor for the event property.
     * @returns The builder for continuation.
     */
    usingKey(keyAccessor: PropertyAccessor<TEvent>): IGraphNodeFromBuilder<TNode, TEvent>;

    /**
     * Only sets properties on a node that already exists, instead of creating it.
     * @returns The builder for continuation.
     */
    onlyWhenExisting(): IGraphNodeFromBuilder<TNode, TEvent>;
}
