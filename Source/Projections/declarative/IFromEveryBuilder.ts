// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { PropertyAccessor } from '@cratis/fundamentals';
import { IAllSetBuilder } from './IAllSetBuilder';

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
     * Excludes child projections from the fromEvery definition.
     * @returns This builder for fluent chaining.
     */
    excludeChildProjections(): IFromEveryBuilder<TReadModel>;
}
