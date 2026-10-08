// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Error thrown when a unit of work is given a concurrency scope for an event source identifier that already has a different
 * scope in the same event sequence. Chronicle validates one scope per event source identifier in an append, so the unit of work
 * cannot commit both.
 */
export class ConflictingConcurrencyScopesInUnitOfWork extends Error {
    /**
     * Initializes a new instance of the {@link ConflictingConcurrencyScopesInUnitOfWork} class.
     * @param eventSequenceId - The identifier of the event sequence the events are added to.
     */
    constructor(readonly eventSequenceId: string) {
        super(
            `An event source in event sequence '${eventSequenceId}' already has a different concurrency scope in this unit of work. ` +
            'Use the same scope for every event of the event source, or commit the events in separate units of work.');
    }
}
