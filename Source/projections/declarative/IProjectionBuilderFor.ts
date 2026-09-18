// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { PropertyAccessor } from '@cratis/fundamentals';
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

    /**
     * Declares this projection to be one of several mutually exclusive representations of the
     * same logical entity. Entering one variant removes the entity from every sibling variant
     * of the same identity.
     * @param identity - The type anchoring the logical identity shared by every variant. Does not need to be a read model itself.
     * @param keyAccessor - Accessor for the property on this variant used as its own key.
     * @returns This builder for fluent chaining.
     */
    variantOf(identity: Function, keyAccessor: PropertyAccessor<TReadModel>): IProjectionBuilderFor<TReadModel>;

    /**
     * Names an event that may create or resurrect this variant. Repeatable - a variant may enter
     * on more than one event. Every other event this projection is built from is automatically
     * reclassified into an update-only join: it can bring an already-active instance up to date,
     * but it can never create or resurrect one.
     * @param eventType - The event constructor.
     * @param key - Optional event property name used as the key. Defaults to the event source identifier.
     * @returns This builder for fluent chaining.
     */
    entersOn(eventType: Function, key?: string): IProjectionBuilderFor<TReadModel>;
}
