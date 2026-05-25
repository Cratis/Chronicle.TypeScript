// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { IProjectionBuilder } from './IProjectionBuilder';

/**
 * Defines the top-level projection builder for a specific read model type.
 * Extends the core builder with projection-wide configuration options.
 * @template TReadModel - The read model type this projection produces.
 */
export interface IProjectionBuilderFor<TReadModel>
    extends IProjectionBuilder<TReadModel, IProjectionBuilderFor<TReadModel>> {
    /**
     * Specifies the event sequence this projection should read from.
     * @param eventSequenceId - The identifier of the event sequence.
     * @returns This builder for fluent chaining.
     */
    fromEventSequence(eventSequenceId: string): IProjectionBuilderFor<TReadModel>;

    /**
     * Sets the container name used to store read model instances (e.g., collection or table name).
     * @param name - The container name.
     * @returns This builder for fluent chaining.
     */
    containerName(name: string): IProjectionBuilderFor<TReadModel>;

    /**
     * Marks this projection as not rewindable, preventing historical event replay.
     * @returns This builder for fluent chaining.
     */
    notRewindable(): IProjectionBuilderFor<TReadModel>;

    /**
     * Marks this projection as passive, meaning it will not actively observe events.
     * @returns This builder for fluent chaining.
     */
    passive(): IProjectionBuilderFor<TReadModel>;
}
