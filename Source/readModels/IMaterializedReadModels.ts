// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Constructor } from '@cratis/fundamentals';

/**
 * Defines a system for working with materialized read model instances stored in the sink.
 */
export interface IMaterializedReadModels {
    /**
     * Gets paginated instances of a read model from the sink.
     * @param readModelType - The read model type to retrieve.
     * @param skip - Number of instances to skip. Defaults to zero.
     * @param take - Number of instances to retrieve. Defaults to 50.
     * @returns Collection of read model instances.
     */
    getInstances<TReadModel>(readModelType: Constructor<TReadModel>, skip?: number, take?: number): Promise<TReadModel[]>;

    /**
     * Observes changes for a paginated window of read model instances from the sink.
     * @param readModelType - The read model type to observe.
     * @param skip - Number of instances to skip. Defaults to zero.
     * @param take - Number of instances to observe. Defaults to 50.
     * @returns An async iterable of read model instance collections.
     */
    observeInstances<TReadModel>(readModelType: Constructor<TReadModel>, skip?: number, take?: number): AsyncIterable<TReadModel[]>;
}
