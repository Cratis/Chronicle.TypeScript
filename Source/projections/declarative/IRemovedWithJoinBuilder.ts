// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { PropertyAccessor } from '@cratis/fundamentals';

/**
 * Defines the builder for configuring the removal of a read model instance via a join event.
 * @template TReadModel - The read model type.
 * @template TEvent - The event type that triggers removal.
 */
export interface IRemovedWithJoinBuilder<TReadModel, TEvent> {
    /**
     * Sets the read model property that forms the relationship for the join removal.
     * @param readModelPropertyAccessor - Accessor for the read model property to join on.
     * @returns This builder for fluent chaining.
     */
    on(readModelPropertyAccessor: PropertyAccessor<TReadModel>): IRemovedWithJoinBuilder<TReadModel, TEvent>;

    /**
     * Uses an event property as the key to identify the instance to remove.
     * @param keyAccessor - Accessor for the event property used as key.
     * @returns This builder for fluent chaining.
     */
    usingKey(keyAccessor: PropertyAccessor<TEvent>): IRemovedWithJoinBuilder<TReadModel, TEvent>;
}
