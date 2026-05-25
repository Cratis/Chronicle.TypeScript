// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { PropertyAccessor } from '@cratis/fundamentals';
import { IProjectionBuilder } from './IProjectionBuilder';

/**
 * Defines the builder for a children collection sub-projection.
 * @template TParentReadModel - The parent read model type.
 * @template TChildReadModel - The child read model type.
 */
export interface IChildrenBuilder<TParentReadModel, TChildReadModel>
    extends IProjectionBuilder<TChildReadModel, IChildrenBuilder<TParentReadModel, TChildReadModel>> {
    /**
     * Sets the property on the child model that identifies instances in the collection.
     * @param propertyAccessor - Accessor for the identifying property on the child model.
     * @returns This builder for fluent chaining.
     */
    identifiedBy(
        propertyAccessor: PropertyAccessor<TChildReadModel>
    ): IChildrenBuilder<TParentReadModel, TChildReadModel>;

    /**
     * Defines the event and property from which the child is created as a value.
     * @param propertyAccessor - Accessor for the property on the event representing the child.
     * @returns This builder for fluent chaining.
     */
    fromEventProperty<TEvent>(
        propertyAccessor: PropertyAccessor<TEvent>
    ): IChildrenBuilder<TParentReadModel, TChildReadModel>;
}
