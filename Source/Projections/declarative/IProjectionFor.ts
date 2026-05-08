// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { IProjectionBuilderFor } from './IProjectionBuilderFor';

/**
 * Defines the contract for a declarative projection class bound to a specific read model type.
 * Implement this interface on any class decorated with {@link projection} to provide a type-safe
 * builder-based configuration for the projection.
 * @template TReadModel - The read model type this projection produces.
 */
export interface IProjectionFor<TReadModel> {
    /**
     * Configures the projection using the provided builder.
     * @param builder - The projection builder to configure.
     */
    define(builder: IProjectionBuilderFor<TReadModel>): void;
}
