// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { PropertyAccessor } from '@cratis/fundamentals';
import { IReadModelPropertiesBuilder } from './IReadModelPropertiesBuilder';

/**
 * Defines the builder for configuring a join projection from a specific event type.
 * @template TReadModel - The read model type.
 * @template TEvent - The event type.
 */
export interface IJoinBuilder<TReadModel, TEvent>
    extends IReadModelPropertiesBuilder<TReadModel, TEvent, IJoinBuilder<TReadModel, TEvent>> {
    /**
     * Sets the property on the read model that forms the relationship for the join.
     * @param readModelPropertyAccessor - Accessor for the read model property to join on.
     * @returns This builder for fluent chaining.
     */
    on(readModelPropertyAccessor: PropertyAccessor<TReadModel>): IJoinBuilder<TReadModel, TEvent>;
}
