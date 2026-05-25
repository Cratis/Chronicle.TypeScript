// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { IUniqueConstraintBuilder } from './IUniqueConstraintBuilder';

/**
 * Defines the builder for building constraints.
 * Matches the C# IConstraintBuilder contract.
 */
export interface IConstraintBuilder {
    /**
     * Scopes the constraint per event source type.
     * @returns This builder for fluent chaining.
     */
    perEventSourceType(): IConstraintBuilder;

    /**
     * Scopes the constraint per event stream type.
     * @returns This builder for fluent chaining.
     */
    perEventStreamType(): IConstraintBuilder;

    /**
     * Scopes the constraint per event stream identifier.
     * @returns This builder for fluent chaining.
     */
    perEventStreamId(): IConstraintBuilder;

    /**
     * Starts building a unique constraint using a fluent builder callback.
     * @param callback - Callback that configures the unique constraint via {@link IUniqueConstraintBuilder}.
     * @returns This builder for fluent chaining.
     */
    unique(callback: (builder: IUniqueConstraintBuilder) => void): IConstraintBuilder;

    /**
     * Adds a unique constraint for a specific event type.
     * This means there can only be one instance of this event type per event source identifier.
     * @param message - Optional violation message.
     * @param name - Optional constraint name.
     * @returns This builder for fluent chaining.
     */
    uniqueFor(eventType: Function, message?: string, name?: string): IConstraintBuilder;
}
