// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { ConstraintEventSequence } from './ConstraintEventSequences.js';
import { IUniqueConstraintBuilder } from './IUniqueConstraintBuilder.js';

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
     * Applies the constraints defined on this builder only to specific event sequences.
     * By default a constraint applies to every event sequence its event types are appended to, and each
     * sequence keeps its own index. The Kernel neither validates nor indexes a constraint for a sequence it does
     * not apply to, so a fact forwarded to another sequence (such as the outbox) does not claim a value there.
     * It applies to every constraint on this builder wherever in the chain it is called; calling it again adds
     * to the event sequences already declared.
     * @param eventSequenceIds - The event sequences the constraints apply to.
     * @returns This builder for fluent chaining.
     */
    forEventSequences(...eventSequenceIds: ConstraintEventSequence[]): IConstraintBuilder;

    /**
     * Applies the constraints defined on this builder only to the event log.
     * Shorthand for {@link IConstraintBuilder.forEventSequences} with `EventSequenceId.eventLog`.
     * @returns This builder for fluent chaining.
     */
    forEventLog(): IConstraintBuilder;

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
