// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { AppendResult } from './AppendResult';
import { EventSequenceId } from './EventSequenceId';
import { EventSequenceNumber } from './EventSequenceNumber';

/**
 * Options for appending an event to an event sequence.
 */
export interface AppendOptions {
    /** Optional correlation identifier for tracking the append operation. */
    correlationId?: string;

    /** Optional explicit sequence number to use for the event. */
    eventSourceId?: string;
}

/**
 * Defines the API surface for an event sequence.
 */
export interface IEventSequence {
    /** The unique identifier of this event sequence. */
    readonly id: EventSequenceId;

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
