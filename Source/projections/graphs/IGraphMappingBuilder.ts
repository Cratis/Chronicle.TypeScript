// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { PropertyAccessor } from '@cratis/fundamentals';
import type { IAddBuilder } from '../declarative/IAddBuilder.js';
import type { ISetBuilder } from '../declarative/ISetBuilder.js';
import type { ISubtractBuilder } from '../declarative/ISubtractBuilder.js';

/**
 * Defines the property mappings shared by nodes and edges.
 * @template TElement - The type of the node or edge.
 * @template TEvent - The type of event.
 * @template TSelf - The type of the builder, for continuation.
 */
export interface IGraphMappingBuilder<TElement, TEvent, TSelf> {
    /**
     * Sets a property.
     * @param propertyAccessor - Accessor for the property on the node or edge.
     * @returns The builder for what to set it to.
     */
    set(propertyAccessor: PropertyAccessor<TElement>): ISetBuilder<TEvent, TSelf>;

    /**
     * Adds the value of an event property to a counter property.
     * @param propertyAccessor - Accessor for the counter property.
     * @returns The builder for which event property to add.
     */
    add(propertyAccessor: PropertyAccessor<TElement>): IAddBuilder<TEvent, TSelf>;

    /**
     * Subtracts the value of an event property from a counter property.
     * @param propertyAccessor - Accessor for the counter property.
     * @returns The builder for which event property to subtract.
     */
    subtract(propertyAccessor: PropertyAccessor<TElement>): ISubtractBuilder<TEvent, TSelf>;

    /**
     * Increments a counter property by one.
     * @param propertyAccessor - Accessor for the counter property.
     * @returns The builder for continuation.
     */
    increment(propertyAccessor: PropertyAccessor<TElement>): TSelf;

    /**
     * Decrements a counter property by one.
     * @param propertyAccessor - Accessor for the counter property.
     * @returns The builder for continuation.
     */
    decrement(propertyAccessor: PropertyAccessor<TElement>): TSelf;

    /**
     * Counts the events on a counter property.
     * @param propertyAccessor - Accessor for the counter property.
     * @returns The builder for continuation.
     */
    count(propertyAccessor: PropertyAccessor<TElement>): TSelf;
}
