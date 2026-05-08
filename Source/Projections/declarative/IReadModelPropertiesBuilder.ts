// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { PropertyAccessor } from '@cratis/fundamentals';
import { ICompositeKeyBuilder } from './ICompositeKeyBuilder';
import { IAddBuilder } from './IAddBuilder';
import { IAddChildBuilder } from './IAddChildBuilder';
import { ISetBuilder } from './ISetBuilder';
import { ISubtractBuilder } from './ISubtractBuilder';

/**
 * Defines the common read model property mapping operations shared by from and join builders.
 * @template TReadModel - The read model type.
 * @template TEvent - The event type.
 * @template TBuilder - The concrete builder type for fluent return.
 */
export interface IReadModelPropertiesBuilder<TReadModel, TEvent, TBuilder> {
    /**
     * Uses an event property as the key for this projection.
     * @param keyAccessor - Accessor for the event property used as key.
     * @returns This builder for fluent chaining.
     */
    usingKey(keyAccessor: PropertyAccessor<TEvent>): TBuilder;

    /**
     * Uses a named event context property as the key for this projection.
     * @param contextPropertyName - The name of the context property.
     * @returns This builder for fluent chaining.
     */
    usingKeyFromContext(contextPropertyName: string): TBuilder;

    /**
     * Uses an event property as the parent key for child projections.
     * @param keyAccessor - Accessor for the event property used as parent key.
     * @returns This builder for fluent chaining.
     */
    usingParentKey(keyAccessor: PropertyAccessor<TEvent>): TBuilder;

    /**
     * Uses a named event context property as the parent key for child projections.
     * @param contextPropertyName - The name of the context property.
     * @returns This builder for fluent chaining.
     */
    usingParentKeyFromContext(contextPropertyName: string): TBuilder;

    /**
     * Uses a composite key built from multiple event properties.
     * @param builderCallback - Callback for configuring the composite key builder.
     * @returns This builder for fluent chaining.
     */
    usingCompositeKey<TKeyType>(builderCallback: (builder: ICompositeKeyBuilder<TKeyType, TEvent>) => void): TBuilder;

    /**
     * Uses a composite parent key built from multiple event properties.
     * @param builderCallback - Callback for configuring the composite key builder.
     * @returns This builder for fluent chaining.
     */
    usingParentCompositeKey<TKeyType>(builderCallback: (builder: ICompositeKeyBuilder<TKeyType, TEvent>) => void): TBuilder;

    /**
     * Uses a constant string value as the key for this projection.
     * @param value - The constant key value.
     * @returns This builder for fluent chaining.
     */
    usingConstantKey(value: string): TBuilder;

    /**
     * Uses a constant string value as the parent key for this projection.
     * @param value - The constant parent key value.
     * @returns This builder for fluent chaining.
     */
    usingConstantParentKey(value: string): TBuilder;

    /**
     * Increments the specified read model property by one when this event occurs.
     * @param readModelPropertyAccessor - Accessor for the read model property to increment.
     * @returns This builder for fluent chaining.
     */
    increment(readModelPropertyAccessor: PropertyAccessor<TReadModel>): TBuilder;

    /**
     * Decrements the specified read model property by one when this event occurs.
     * @param readModelPropertyAccessor - Accessor for the read model property to decrement.
     * @returns This builder for fluent chaining.
     */
    decrement(readModelPropertyAccessor: PropertyAccessor<TReadModel>): TBuilder;

    /**
     * Begins an add operation on the specified read model property.
     * @param readModelPropertyAccessor - Accessor for the read model property to add to.
     * @returns An add builder for specifying the event property value.
     */
    add(readModelPropertyAccessor: PropertyAccessor<TReadModel>): IAddBuilder<TEvent, TBuilder>;

    /**
     * Begins a subtract operation on the specified read model property.
     * @param readModelPropertyAccessor - Accessor for the read model property to subtract from.
     * @returns A subtract builder for specifying the event property value.
     */
    subtract(readModelPropertyAccessor: PropertyAccessor<TReadModel>): ISubtractBuilder<TEvent, TBuilder>;

    /**
     * Counts the number of matching events into the specified read model property.
     * @param readModelPropertyAccessor - Accessor for the read model property to store the count in.
     * @returns This builder for fluent chaining.
     */
    count(readModelPropertyAccessor: PropertyAccessor<TReadModel>): TBuilder;

    /**
     * Adds a child model from the event to a collection property on the read model.
     * @param targetPropertyAccessor - Accessor for the collection property on the read model.
     * @param eventPropertyAccessorOrBuilderCallback - Either a direct event property accessor or a builder callback.
     * @returns This builder for fluent chaining.
     */
    addChild<TChildModel>(
        targetPropertyAccessor: PropertyAccessor<TReadModel>,
        eventPropertyAccessorOrBuilderCallback: PropertyAccessor<TEvent> | ((builder: IAddChildBuilder<TChildModel, TEvent>) => void)
    ): TBuilder;

    /**
     * Begins a set operation to map an event property to the specified read model property.
     * @param readModelPropertyAccessor - Accessor for the read model property to set.
     * @returns A set builder for specifying the event property value.
     */
    set(readModelPropertyAccessor: PropertyAccessor<TReadModel>): ISetBuilder<TEvent, TBuilder>;

    /**
     * Begins a set operation that maps the entire event value to a read model property.
     * @returns A set builder for specifying the target read model property.
     */
    setThisValue(): ISetBuilder<TEvent, TBuilder>;
}
