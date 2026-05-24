// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { Guid } from '@cratis/fundamentals';
import { EventSequenceId } from '../EventSequences/EventSequenceId';
import { AppendResult } from '../EventSequences/AppendResult';

/**
 * Represents a unit of work for buffering event appends and committing them as transactions.
 */
export interface IUnitOfWork {
    /** The correlation identifier used for all appends within this unit of work. */
    readonly correlationId: Guid;

    /** Whether the unit of work has been completed (committed or rolled back). */
    readonly isCompleted: boolean;

    /** Whether all append operations in this unit of work succeeded. */
    readonly isSuccess: boolean;

    /**
     * Adds an event to the unit of work.
     * @param eventSequenceId - The identifier of the event sequence to append to.
     * @param eventSourceId - The event source identifier.
     * @param event - The event payload.
     */
    addEvent(eventSequenceId: EventSequenceId, eventSourceId: string, event: object): void;

    /**
     * Gets all events currently buffered in this unit of work.
     * @returns The buffered events in append order.
     */
    getEvents(): ReadonlyArray<object>;

    /**
     * Gets append results from the latest commit.
     * @returns The append results in append order.
     */
    getAppendResults(): ReadonlyArray<AppendResult>;

    /**
     * Commits all buffered events.
     */
    commit(): Promise<void>;

    /**
     * Rolls back all buffered events.
     */
    rollback(): Promise<void>;

    /**
     * Sets a callback that runs when the unit of work completes.
     * @param callback - Callback to invoke on completion.
     */
    onCompleted(callback: (unitOfWork: IUnitOfWork) => void): void;
}
