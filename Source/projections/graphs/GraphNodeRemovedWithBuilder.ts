// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { PropertyAccessor } from '@cratis/fundamentals';
import type { IGraphNodeRemovedWithBuilder } from './IGraphNodeRemovedWithBuilder.js';
import { propertyPathOf } from './propertyPathOf.js';

/**
 * Implements {@link IGraphNodeRemovedWithBuilder}.
 * @template TEvent - The type of event.
 */
export class GraphNodeRemovedWithBuilder<TEvent> implements IGraphNodeRemovedWithBuilder<TEvent> {
    /** The expression for the key of the node, or undefined for the event source id. */
    key?: string;

    /** Whether the edges attached to the node are deleted with it. */
    detachEdges = false;

    /** @inheritdoc */
    usingKey(keyAccessor: PropertyAccessor<TEvent>): IGraphNodeRemovedWithBuilder<TEvent> {
        this.key = propertyPathOf(keyAccessor);
        return this;
    }

    /** @inheritdoc */
    detach(): IGraphNodeRemovedWithBuilder<TEvent> {
        this.detachEdges = true;
        return this;
    }
}
