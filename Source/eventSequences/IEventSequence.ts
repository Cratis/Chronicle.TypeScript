// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { AppendOptions } from './AppendOptions';
import { EventForEventSourceId } from './EventForEventSourceId';
import { AppendResult } from './AppendResult';
import { EventSequenceId } from './EventSequenceId';
import { EventSequenceNumber } from './EventSequenceNumber';
import { ITransactionalEventSequence } from './ITransactionalEventSequence';

/**
 * Defines the API surface for an event sequence.
 */
export interface IEventSequence {
    /** The unique identifier of this event sequence. */
    readonly id: EventSequenceId;

    /** Transactional append operations for this event sequence. */
    readonly transactional: ITransactionalEventSequence;

    /**
     * Appends a single event to the event sequence.
     * @param eventSourceId - The identifier of the event source.
     * @param event - The event to append.
     * @param options - Optional append options.
     * @returns The result of the append operation.
     */
    append(eventSourceId: string, event: object, options?: AppendOptions): Promise<AppendResult>;

    /**
     * Appends multiple events to the event sequence.
     * @param eventSourceId - The identifier of the event source.
     * @param events - The events to append.
     * @param options - Optional append options.
     * @returns The results of the append operations, one per event.
     */
    appendMany(eventSourceId: string, events: object[], options?: AppendOptions): Promise<AppendResult[]>;

    /**
     * Appends multiple events to the event sequence, each with its own event source identifier.
     * @param events - The events paired with their event source identifiers.
     * @param options - Optional append options.
     * @returns The results of the append operations, one per event.
     */
    appendMany(events: EventForEventSourceId[], options?: AppendOptions): Promise<AppendResult[]>;

    /**
     * Gets the tail sequence number (the number of the most recently appended event).
     * @param eventSourceId - Optional event source identifier to filter by.
     * @returns The tail sequence number.
     */
    getTailSequenceNumber(eventSourceId?: string): Promise<EventSequenceNumber>;

    /**
     * Determines whether there are events for a given event source identifier.
     * @param eventSourceId - The event source identifier to check.
     * @returns True if there are events for the given event source.
     */
    hasEventsFor(eventSourceId: string): Promise<boolean>;
}
