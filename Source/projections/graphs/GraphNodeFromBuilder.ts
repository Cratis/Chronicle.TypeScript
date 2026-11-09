// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { PropertyAccessor } from '@cratis/fundamentals';
import { GraphMappingBuilder } from './GraphMappingBuilder.js';
import type { IGraphNodeFromBuilder } from './IGraphNodeFromBuilder.js';
import { propertyPathOf } from './propertyPathOf.js';

/**
 * Implements {@link IGraphNodeFromBuilder}.
 * @template TNode - The type of node.
 * @template TEvent - The type of event.
 */
export class GraphNodeFromBuilder<TNode, TEvent> extends GraphMappingBuilder<TNode, TEvent, IGraphNodeFromBuilder<TNode, TEvent>>
    implements IGraphNodeFromBuilder<TNode, TEvent> {
    /** The expression for the key of the node, or undefined for the event source id. */
    key?: string;

    /** Whether the event only changes a node that already exists. */
    updateOnly = false;

    /** @inheritdoc */
    protected get self(): IGraphNodeFromBuilder<TNode, TEvent> {
        return this;
    }

    /** @inheritdoc */
    usingKey(keyAccessor: PropertyAccessor<TEvent>): IGraphNodeFromBuilder<TNode, TEvent> {
        this.key = propertyPathOf(keyAccessor);
        return this;
    }

    /** @inheritdoc */
    onlyWhenExisting(): IGraphNodeFromBuilder<TNode, TEvent> {
        this.updateOnly = true;
        return this;
    }
}
