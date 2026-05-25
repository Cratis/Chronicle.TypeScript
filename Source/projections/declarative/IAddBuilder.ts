// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { PropertyAccessor } from '@cratis/fundamentals';

/**
 * Defines a builder for configuring an add operation on a read model property.
 * @template TEvent - The event type.
 * @template TParentBuilder - The parent builder type for fluent return.
 */
export interface IAddBuilder<TEvent, TParentBuilder> {
    /**
     * Adds the value of the specified event property to the read model property.
     * @param eventPropertyAccessor - Accessor for the source property on the event.
     * @returns The parent builder for fluent chaining.
     */
    with(eventPropertyAccessor: PropertyAccessor<TEvent>): TParentBuilder;
}
