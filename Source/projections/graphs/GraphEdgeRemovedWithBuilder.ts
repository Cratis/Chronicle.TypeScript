// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { PropertyAccessor } from '@cratis/fundamentals';
import type { IGraphEdgeRemovedWithBuilder } from './IGraphEdgeRemovedWithBuilder.js';
import { propertyPathOf } from './propertyPathOf.js';

/**
 * Implements {@link IGraphEdgeRemovedWithBuilder}.
 * @template TEvent - The type of event.
 */
export class GraphEdgeRemovedWithBuilder<TEvent> implements IGraphEdgeRemovedWithBuilder<TEvent> {
    /** The expression for the key of the source node, or undefined for the event source id. */
    sourceKey?: string;

    /** The expression for the key of the target node, or undefined for the event source id. */
    targetKey?: string;

    /** The expression for the identity of the edge. */
    identity?: string;

    /** @inheritdoc */
    usingSourceKey(keyAccessor: PropertyAccessor<TEvent>): IGraphEdgeRemovedWithBuilder<TEvent> {
        this.sourceKey = propertyPathOf(keyAccessor);
        return this;
    }

    /** @inheritdoc */
    usingTargetKey(keyAccessor: PropertyAccessor<TEvent>): IGraphEdgeRemovedWithBuilder<TEvent> {
        this.targetKey = propertyPathOf(keyAccessor);
        return this;
    }

    /** @inheritdoc */
    usingIdentity(identityAccessor: PropertyAccessor<TEvent>): IGraphEdgeRemovedWithBuilder<TEvent> {
        this.identity = propertyPathOf(identityAccessor);
        return this;
    }
}
