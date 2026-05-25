// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { IProjectionBuilder } from './IProjectionBuilder';

/**
 * Defines the builder for a nested single-object sub-projection.
 * @template TParentReadModel - The parent read model type.
 * @template TNestedReadModel - The nested object read model type.
 */
export interface INestedBuilder<TParentReadModel, TNestedReadModel>
    extends IProjectionBuilder<TNestedReadModel, INestedBuilder<TParentReadModel, TNestedReadModel>> {
    /**
     * Specifies the event type that clears (sets to null) this nested object.
     * @param eventType - The event constructor that triggers clearing this nested object.
     * @returns This builder for fluent chaining.
     */
    clearWith(eventType: Function): INestedBuilder<TParentReadModel, TNestedReadModel>;
}
