// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { PropertyAccessor } from '@cratis/fundamentals';
import { IChildrenBuilder } from './IChildrenBuilder';
import { IFromBuilder } from './IFromBuilder';
import { IFromEveryBuilder } from './IFromEveryBuilder';
import { IJoinBuilder } from './IJoinBuilder';
import { INestedBuilder } from './INestedBuilder';
import { IRemovedWithBuilder } from './IRemovedWithBuilder';
import { IRemovedWithJoinBuilder } from './IRemovedWithJoinBuilder';

/**
 * Defines the core builder interface for configuring a projection.
 * @template TReadModel - The read model type this projection produces.
 * @template TBuilder - The concrete builder type for fluent return.
 */
export interface IProjectionBuilder<TReadModel, TBuilder> {
    /**
     * Enables automatic property mapping by naming convention.
     * @returns This builder for fluent chaining.
     */
    autoMap(): TBuilder;

    /**
     * Disables automatic property mapping by naming convention.
     * @returns This builder for fluent chaining.
     */
    noAutoMap(): TBuilder;

    /**
     * Provides initial property values for newly created read model instances.
     * @param initialValueProvider - A factory function that returns the initial values.
     * @returns This builder for fluent chaining.
     */
    withInitialValues(initialValueProvider: () => TReadModel): TBuilder;

    /**
     * Configures a projection from a specific event type.
     * @param builderCallback - Optional callback for configuring property mappings.
     * @returns This builder for fluent chaining.
     */
    from<TEvent>(builderCallback?: (builder: IFromBuilder<TReadModel, TEvent>) => void): TBuilder;

    /**
     * Configures a join projection from a specific event type.
     * @param builderCallback - Optional callback for configuring the join mappings.
     * @returns This builder for fluent chaining.
     */
    join<TEvent>(builderCallback?: (builder: IJoinBuilder<TReadModel, TEvent>) => void): TBuilder;

    /**
     * Configures property mappings that apply to every projected event type.
     * @param builderCallback - Callback for configuring the fromEvery mappings.
     * @returns This builder for fluent chaining.
     */
    fromEvery(builderCallback: (builder: IFromEveryBuilder<TReadModel>) => void): TBuilder;

    /**
     * Specifies the event type that causes this read model instance to be removed.
     * @param builderCallback - Optional callback for configuring the removal behavior.
     * @returns This builder for fluent chaining.
     */
    removedWith<TEvent>(builderCallback?: (builder: IRemovedWithBuilder<TReadModel, TEvent>) => void): TBuilder;

    /**
     * Specifies the joined event type that causes this read model instance to be removed.
     * @param builderCallback - Optional callback for configuring the removal behavior.
     * @returns This builder for fluent chaining.
     */
    removedWithJoin<TEvent>(builderCallback?: (builder: IRemovedWithJoinBuilder<TReadModel, TEvent>) => void): TBuilder;

    /**
     * Configures a child collection projection on the specified read model property.
     * @param targetPropertyAccessor - Accessor for the collection property on the read model.
     * @param builderCallback - Callback for configuring the children projection.
     * @returns This builder for fluent chaining.
     */
    children<TChildModel>(
        targetPropertyAccessor: PropertyAccessor<TReadModel>,
        builderCallback: (builder: IChildrenBuilder<TReadModel, TChildModel>) => void
    ): TBuilder;

    /**
     * Configures a nested single-object projection on the specified read model property.
     * @param targetPropertyAccessor - Accessor for the nested property on the read model.
     * @param builderCallback - Callback for configuring the nested projection.
     * @returns This builder for fluent chaining.
     */
    nested<TNestedModel>(
        targetPropertyAccessor: PropertyAccessor<TReadModel>,
        builderCallback: (builder: INestedBuilder<TReadModel, TNestedModel>) => void
    ): TBuilder;
}
