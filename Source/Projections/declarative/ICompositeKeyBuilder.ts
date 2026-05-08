// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { PropertyAccessor } from '@cratis/fundamentals';

/**
 * Defines a builder for constructing composite keys from multiple event properties.
 * @template TKeyType - The composite key type.
 * @template TEvent - The event type.
 */
export interface ICompositeKeyBuilder<TKeyType, TEvent> {
    /**
     * Maps a source event property to a target key property.
     * @param targetPropertyAccessor - Accessor for the property on the key type to populate.
     * @param sourcePropertyAccessor - Accessor for the property on the event to read from.
     * @returns This builder for fluent chaining.
     */
    set(
        targetPropertyAccessor: PropertyAccessor<TKeyType>,
        sourcePropertyAccessor: PropertyAccessor<TEvent>
    ): ICompositeKeyBuilder<TKeyType, TEvent>;
}
