// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { PropertyAccessor } from '@cratis/fundamentals';
import { IProjectionBuilder } from './IProjectionBuilder.js';

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

    /**
     * Adds new children at the start of the collection instead of the end. Updating an existing child never moves it.
     * @returns This builder for fluent chaining.
     */
    prepend(): IChildrenBuilder<TParentReadModel, TChildReadModel>;

    /**
     * Inserts new children at their position when sorted ascending by a child property. Children without a value sort
     * first and updating an existing child never moves it, even when the property changes.
     * @param propertyAccessor - Accessor for the child property to sort by.
     * @returns This builder for fluent chaining.
     */
    orderBy(propertyAccessor: PropertyAccessor<TChildReadModel>): IChildrenBuilder<TParentReadModel, TChildReadModel>;

    /**
     * Inserts new children at their position when sorted descending by a child property. Children without a value sort
     * last and updating an existing child never moves it, even when the property changes.
     * @param propertyAccessor - Accessor for the child property to sort by.
     * @returns This builder for fluent chaining.
     */
    orderByDescending(propertyAccessor: PropertyAccessor<TChildReadModel>): IChildrenBuilder<TParentReadModel, TChildReadModel>;
}
