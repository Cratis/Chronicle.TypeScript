// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { PropertyAccessor } from '@cratis/fundamentals';
import { GraphMappingBuilder } from './GraphMappingBuilder.js';
import type { IGraphEdgeFromBuilder } from './IGraphEdgeFromBuilder.js';
import { propertyPathOf } from './propertyPathOf.js';

/**
 * Implements {@link IGraphEdgeFromBuilder}.
 * @template TEdge - The type of edge.
 * @template TEvent - The type of event.
 */
export class GraphEdgeFromBuilder<TEdge, TEvent> extends GraphMappingBuilder<TEdge, TEvent, IGraphEdgeFromBuilder<TEdge, TEvent>>
    implements IGraphEdgeFromBuilder<TEdge, TEvent> {
    /** The expression for the key of the source node, or undefined for the event source id. */
    sourceKey?: string;

    /** The expression for the key of the target node, or undefined for the event source id. */
    targetKey?: string;

    /** The expression for the identity of the edge. */
    identity?: string;

    /** @inheritdoc */
    protected get self(): IGraphEdgeFromBuilder<TEdge, TEvent> {
        return this;
    }

    /** @inheritdoc */
    usingSourceKey(keyAccessor: PropertyAccessor<TEvent>): IGraphEdgeFromBuilder<TEdge, TEvent> {
        this.sourceKey = propertyPathOf(keyAccessor);
        return this;
    }

    /** @inheritdoc */
    usingTargetKey(keyAccessor: PropertyAccessor<TEvent>): IGraphEdgeFromBuilder<TEdge, TEvent> {
        this.targetKey = propertyPathOf(keyAccessor);
        return this;
    }

    /** @inheritdoc */
    usingIdentity(identityAccessor: PropertyAccessor<TEvent>): IGraphEdgeFromBuilder<TEdge, TEvent> {
        this.identity = propertyPathOf(identityAccessor);
        return this;
    }
}
