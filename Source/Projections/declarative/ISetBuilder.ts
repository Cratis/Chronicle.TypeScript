// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { PropertyAccessor } from '@cratis/fundamentals';

/**
 * Defines a builder for configuring a set operation on a read model property.
 * @template TEvent - The event type.
 * @template TParentBuilder - The parent builder type for fluent return.
 */
export interface ISetBuilder<TEvent, TParentBuilder> {
    /**
     * Maps the read model property from the specified event property.
     * @param eventPropertyAccessor - Accessor for the source property on the event.
     * @returns The parent builder for fluent chaining.
     */
    to(eventPropertyAccessor: PropertyAccessor<TEvent>): TParentBuilder;

    /**
     * Sets the read model property to a constant value.
     * @param value - The constant value to assign.
     * @returns The parent builder for fluent chaining.
     */
    toValue<TProperty>(value: TProperty): TParentBuilder;

    /**
     * Maps the read model property from a named event context property.
     * @param contextPropertyName - The name of the event context property to read from.
     * @returns The parent builder for fluent chaining.
     */
    toEventContextProperty(contextPropertyName: string): TParentBuilder;

    /**
     * Maps the read model property from the event source identifier.
     * @returns The parent builder for fluent chaining.
     */
    toEventSourceId(): TParentBuilder;
}
