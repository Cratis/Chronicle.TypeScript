// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { PropertyAccessor } from '@cratis/fundamentals';
import { ICompositeKeyBuilder } from './ICompositeKeyBuilder.js';
import type { DictionaryKeySource } from './DictionaryKey.js';
import { IAddBuilder } from './IAddBuilder.js';
import { IAddChildBuilder } from './IAddChildBuilder.js';
import { ISetBuilder } from './ISetBuilder.js';
import { ISubtractBuilder } from './ISubtractBuilder.js';

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
     * @param key - Optional dictionary key. When given, the property is a dictionary and the operation targets the entry with this key:
     * an accessor on the event, or a {@link DictionaryKey} for keys from the event context or the identity that caused the event.
     * @returns This builder for fluent chaining.
     */
    increment(readModelPropertyAccessor: PropertyAccessor<TReadModel>, key?: DictionaryKeySource<TEvent>): TBuilder;

    /**
     * Decrements the specified read model property by one when this event occurs.
     * @param readModelPropertyAccessor - Accessor for the read model property to decrement.
     * @param key - Optional dictionary key. When given, the property is a dictionary and the operation targets the entry with this key:
     * an accessor on the event, or a {@link DictionaryKey} for keys from the event context or the identity that caused the event.
     * @returns This builder for fluent chaining.
     */
    decrement(readModelPropertyAccessor: PropertyAccessor<TReadModel>, key?: DictionaryKeySource<TEvent>): TBuilder;

    /**
     * Begins an add operation on the specified read model property.
     * @param readModelPropertyAccessor - Accessor for the read model property to add to.
     * @param key - Optional dictionary key. When given, the property is a dictionary and the operation targets the entry with this key:
     * an accessor on the event, or a {@link DictionaryKey} for keys from the event context or the identity that caused the event.
     * @returns An add builder for specifying the event property value.
     */
    add(readModelPropertyAccessor: PropertyAccessor<TReadModel>, key?: DictionaryKeySource<TEvent>): IAddBuilder<TEvent, TBuilder>;

    /**
     * Begins a subtract operation on the specified read model property.
     * @param readModelPropertyAccessor - Accessor for the read model property to subtract from.
     * @param key - Optional dictionary key. When given, the property is a dictionary and the operation targets the entry with this key:
     * an accessor on the event, or a {@link DictionaryKey} for keys from the event context or the identity that caused the event.
     * @returns A subtract builder for specifying the event property value.
     */
    subtract(readModelPropertyAccessor: PropertyAccessor<TReadModel>, key?: DictionaryKeySource<TEvent>): ISubtractBuilder<TEvent, TBuilder>;

    /**
     * Counts the number of matching events into the specified read model property.
     * @param readModelPropertyAccessor - Accessor for the read model property to store the count in.
     * @param key - Optional dictionary key. When given, the property is a dictionary and the operation targets the entry with this key:
     * an accessor on the event, or a {@link DictionaryKey} for keys from the event context or the identity that caused the event.
     * @returns This builder for fluent chaining.
     */
    count(readModelPropertyAccessor: PropertyAccessor<TReadModel>, key?: DictionaryKeySource<TEvent>): TBuilder;

    /**
     * Adds a child model configured through a child builder to a collection on the read model.
     * Event members remain available while TypeScript resolves the two function-shaped overloads.
     * @param targetPropertyAccessor - Accessor for the collection property on the read model.
     * @param builderCallback - Callback configuring the child identifier and keys.
     * @returns This builder for fluent chaining.
     */
    addChild<TChildModel>(targetPropertyAccessor: (model: TReadModel) => readonly TChildModel[] | null | undefined, builderCallback: (builder: IAddChildBuilder<TChildModel, TEvent> & TEvent) => void): TBuilder;

    /**
     * Adds a child model directly from an event property to a collection on the read model.
     * @param targetPropertyAccessor - Accessor for the collection property on the read model.
     * @param eventPropertyAccessor - Accessor for the event property holding the child value.
     * @returns This builder for fluent chaining.
     */
    addChild<TChildModel>(targetPropertyAccessor: (model: TReadModel) => readonly TChildModel[] | null | undefined, eventPropertyAccessor: PropertyAccessor<TEvent>): TBuilder;

    /**
     * Retains support for arbitrary read model accessors and explicitly selected child types.
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
     * @param key - Optional dictionary key. When given, the property is a dictionary and the operation targets the entry with this key:
     * an accessor on the event, or a {@link DictionaryKey} for keys from the event context or the identity that caused the event.
     * @returns A set builder for specifying the event property value.
     */
    set(readModelPropertyAccessor: PropertyAccessor<TReadModel>, key?: DictionaryKeySource<TEvent>): ISetBuilder<TEvent, TBuilder>;

    /**
     * Begins a set operation that only assigns the read model property while it has no value yet. The first event that
     * carries a value wins; later events leave the property as it is. Use it to capture a first occurrence - for instance
     * `setOnce(m => m.firstSeen).toEventContextProperty('occurred')` - without a dedicated creation event.
     * @param readModelPropertyAccessor - Accessor for the read model property to set once.
     * @param key - Optional dictionary key. When given, the property is a dictionary and the operation targets the entry with this key:
     * an accessor on the event, or a {@link DictionaryKey} for keys from the event context or the identity that caused the event.
     * @returns A set builder for specifying the value.
     */
    setOnce(readModelPropertyAccessor: PropertyAccessor<TReadModel>, key?: DictionaryKeySource<TEvent>): ISetBuilder<TEvent, TBuilder>;

    /**
     * Removes an entry from a dictionary-typed read model property when this event occurs. Removing a key that is not
     * present leaves the dictionary as it is.
     * @param readModelPropertyAccessor - Accessor for the dictionary-typed read model property.
     * @param key - The key of the entry to remove: an accessor on the event, or a {@link DictionaryKey}.
     * @returns This builder for fluent chaining.
     */
    removeKey(readModelPropertyAccessor: PropertyAccessor<TReadModel>, key: DictionaryKeySource<TEvent>): TBuilder;

    /**
     * Begins a set operation that maps the entire event value to a read model property.
     * @returns A set builder for specifying the target read model property.
     */
    setThisValue(): ISetBuilder<TEvent, TBuilder>;
}
