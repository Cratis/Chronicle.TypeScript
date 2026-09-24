// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { PropertyAccessor } from '@cratis/fundamentals';
import { IAllSetBuilder } from './IAllSetBuilder.js';

/**
 * Defines the builder for configuring property mappings that apply to every projected event.
 * @template TReadModel - The read model type.
 */
export interface IFromEveryBuilder<TReadModel> {
    /**
     * Begins a set operation on the specified read model property.
     * @param readModelPropertyAccessor - Accessor for the read model property to set.
     * @returns An all-set builder for specifying the value source.
     */
    set(readModelPropertyAccessor: PropertyAccessor<TReadModel>): IAllSetBuilder<TReadModel, IFromEveryBuilder<TReadModel>>;

    /**
     * Counts every projected event into a dictionary property, using a dynamic key resolved from an event context property.
     * The dictionary value at the resolved key is incremented by one for each matching event.
     * @param readModelPropertyAccessor - Accessor for the read model dictionary property (Record<string, number>).
     * @param contextPropertyName - The event context property name used as the dictionary key (e.g., 'eventType').
     * @returns This builder for fluent chaining.
     */
    count(readModelPropertyAccessor: PropertyAccessor<TReadModel>, contextPropertyName: string): IFromEveryBuilder<TReadModel>;

    /**
     * Increments a dictionary property by one for every projected event, using a dynamic key resolved from an event context property.
     * @param readModelPropertyAccessor - Accessor for the read model dictionary property (Record<string, number>).
     * @param contextPropertyName - The event context property name used as the dictionary key (e.g., 'eventType').
     * @returns This builder for fluent chaining.
     */
    increment(readModelPropertyAccessor: PropertyAccessor<TReadModel>, contextPropertyName: string): IFromEveryBuilder<TReadModel>;

    /**
     * Decrements a dictionary property by one for every projected event, using a dynamic key resolved from an event context property.
     * @param readModelPropertyAccessor - Accessor for the read model dictionary property (Record<string, number>).
     * @param contextPropertyName - The event context property name used as the dictionary key (e.g., 'eventType').
     * @returns This builder for fluent chaining.
     */
    decrement(readModelPropertyAccessor: PropertyAccessor<TReadModel>, contextPropertyName: string): IFromEveryBuilder<TReadModel>;

    /**
     * Excludes child projections from the fromEvery definition.
     * @returns This builder for fluent chaining.
     */
    excludeChildProjections(): IFromEveryBuilder<TReadModel>;
}
