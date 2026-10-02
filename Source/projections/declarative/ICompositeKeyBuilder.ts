// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { PropertyAccessor } from '@cratis/fundamentals';
import { ICompositeKeySetBuilder } from './ICompositeKeySetBuilder.js';

/**
 * Defines a builder for constructing composite keys from event properties, context and constants.
 * @template TKeyType - The composite key type.
 * @template TEvent - The event type.
 */
export interface ICompositeKeyBuilder<TKeyType, TEvent> {
    /**
     * Configures a key part from an event property, event context property, event source id or constant.
     * @param targetPropertyAccessor - Accessor for the property on the key type to populate.
     * @returns A set-expression builder whose to methods return this composite key builder.
     */
    set<TProperty>(targetPropertyAccessor: (key: TKeyType) => TProperty): ICompositeKeySetBuilder<TKeyType, TEvent, TProperty>;

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

    /**
     * Builds the composite key expression from the configured parts.
     * @returns The `$composite(...)` property expression.
     */
    build(): string;
}
