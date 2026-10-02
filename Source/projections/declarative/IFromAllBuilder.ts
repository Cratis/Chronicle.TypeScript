// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { PropertyAccessor } from '@cratis/fundamentals';
import type { IAllSetBuilder } from './IAllSetBuilder.js';

/** Configures mappings for every event, including types not otherwise declared by the projection. */
export interface IFromAllBuilder<TReadModel> {
    /**
     * Starts an assignment to a read-model property.
     * @param readModelPropertyAccessor - Target property accessor.
     * @returns The assignment builder, continuing with this all-events builder.
     */
    set(readModelPropertyAccessor: PropertyAccessor<TReadModel>): IAllSetBuilder<TReadModel, IFromAllBuilder<TReadModel>>;

    /**
     * Counts every event, optionally under a dynamic dictionary key.
     * @param readModelPropertyAccessor - Scalar or dictionary target accessor.
     * @param contextPropertyName - Optional event-context path for the dictionary key, such as `eventType.id`.
     * @returns This builder for chaining.
     */
    count(readModelPropertyAccessor: PropertyAccessor<TReadModel>, contextPropertyName?: string): IFromAllBuilder<TReadModel>;

    /**
     * Increments a property for every event, optionally under a dynamic dictionary key.
     * @param readModelPropertyAccessor - Scalar or dictionary target accessor.
     * @param contextPropertyName - Optional event-context path for the dictionary key.
     * @returns This builder for chaining.
     */
    increment(readModelPropertyAccessor: PropertyAccessor<TReadModel>, contextPropertyName?: string): IFromAllBuilder<TReadModel>;

    /**
     * Decrements a property for every event, optionally under a dynamic dictionary key.
     * @param readModelPropertyAccessor - Scalar or dictionary target accessor.
     * @param contextPropertyName - Optional event-context path for the dictionary key.
     * @returns This builder for chaining.
     */
    decrement(readModelPropertyAccessor: PropertyAccessor<TReadModel>, contextPropertyName?: string): IFromAllBuilder<TReadModel>;
}
