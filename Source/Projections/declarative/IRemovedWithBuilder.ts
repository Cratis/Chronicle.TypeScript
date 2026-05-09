// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { PropertyAccessor } from '@cratis/fundamentals';

/**
 * Defines the builder for configuring the removal of a read model instance via an event.
 * @template TReadModel - The read model type.
 * @template TEvent - The event type that triggers removal.
 */
export interface IRemovedWithBuilder<TReadModel, TEvent> {
    /**
     * Uses an event property as the key to identify the instance to remove.
     * @param keyAccessor - Accessor for the event property used as key.
     * @returns This builder for fluent chaining.
     */
    usingKey(keyAccessor: PropertyAccessor<TEvent>): IRemovedWithBuilder<TReadModel, TEvent>;

    /**
     * Uses a named event context property as the key to identify the instance to remove.
     * @param contextPropertyName - The name of the event context property.
     * @returns This builder for fluent chaining.
     */
    usingKeyFromContext(contextPropertyName: string): IRemovedWithBuilder<TReadModel, TEvent>;
}
