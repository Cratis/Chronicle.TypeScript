// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { PropertyAccessor } from '@cratis/fundamentals';

/**
 * Defines a builder for set operations that apply to all events (fromEvery).
 * @template TReadModel - The read model type.
 * @template TParentBuilder - The parent builder type for fluent return.
 */
export interface IAllSetBuilder<TReadModel, TParentBuilder> {
    /**
     * Maps the value to the specified read model property.
     * @param readModelPropertyAccessor - Accessor for the target property on the read model.
     * @returns The parent builder for fluent chaining.
     */
    to(readModelPropertyAccessor: PropertyAccessor<TReadModel>): TParentBuilder;

    /**
     * Maps the value from a named event context property.
     * @param contextPropertyName - The name of the event context property to read from.
     * @returns The parent builder for fluent chaining.
     */
    toEventContextProperty(contextPropertyName: string): TParentBuilder;

    /**
     * Maps the value from the event source identifier.
     * @returns The parent builder for fluent chaining.
     */
    toEventSourceId(): TParentBuilder;
}
