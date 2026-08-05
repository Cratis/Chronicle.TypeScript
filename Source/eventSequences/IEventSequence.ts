// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Constructor } from '@cratis/fundamentals';
import type { AppendedEvent } from '../events/AppendedEvent';
import { AppendOptions } from './AppendOptions';
import { CompleteStreamResult } from './CompleteStreamResult';
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
     * Gets the next sequence number that will be assigned to the next appended event.
     * @returns The next sequence number.
     */
    getNextSequenceNumber(): Promise<EventSequenceNumber>;

    /**
     * Gets the tail sequence number (the number of the most recently appended event).
     * @param eventSourceId - Optional event source identifier to filter by.
     * @param eventSourceType - Optional event source type to filter by.
     * @param eventStreamType - Optional event stream type to filter by.
     * @param eventStreamId - Optional event stream identifier to filter by.
     * @param filterEventTypes - Optional collection of event type constructors to filter by.
     * @returns The tail sequence number.
     */
    getTailSequenceNumber(
        eventSourceId?: string,
        eventSourceType?: string,
        eventStreamType?: string,
        eventStreamId?: string,
        filterEventTypes?: Constructor[]
    ): Promise<EventSequenceNumber>;

    /**
     * Gets the tail sequence number for a specific observer (reactor/reducer) type, based on the
     * tail of the event types the observer handles.
     * @param observerType - The observer (reactor/reducer) type to get the tail sequence number for.
     * @returns The tail sequence number.
     */
    getTailSequenceNumberForObserver(observerType: Constructor): Promise<EventSequenceNumber>;

    /**
     * Determines whether there are events for a given event source identifier.
     * @param eventSourceId - The event source identifier to check.
     * @returns True if there are events for the given event source.
     */
    hasEventsFor(eventSourceId: string): Promise<boolean>;

    /**
     * Gets all events for a specific event source, optionally filtered to specific event types.
     * @param eventSourceId - The event source identifier to get events for.
     * @param eventTypes - Collection of event type constructors to filter by.
     * @param eventStreamType - Optional event stream type. Defaults to the default stream type.
     * @param eventStreamId - Optional event stream identifier. Defaults to the default stream.
     * @param eventSourceType - Optional event source type. Defaults to the default source type.
     * @returns A collection of appended events.
     */
    getForEventSourceIdAndEventTypes(
        eventSourceId: string,
        eventTypes: Constructor[],
        eventStreamType?: string,
        eventStreamId?: string,
        eventSourceType?: string
    ): Promise<AppendedEvent[]>;

    /**
     * Gets all events after and including a given sequence number, optionally filtered by event
     * source identifier and event types.
     * @param sequenceNumber - The sequence number of the first event to get from.
     * @param eventSourceId - Optional event source identifier to filter by.
     * @param filterEventTypes - Optional collection of event type constructors to filter by.
     * @returns A collection of appended events.
     */
    getFromSequenceNumber(
        sequenceNumber: EventSequenceNumber,
        eventSourceId?: string,
        filterEventTypes?: Constructor[]
    ): Promise<AppendedEvent[]>;

    /**
     * Redacts a single event at a specific sequence number.
     * @param sequenceNumber - The sequence number of the event to redact.
     * @param reason - The reason for redacting the event.
     * @returns A promise that resolves when the redaction has completed.
     * @remarks
     * This is a permanent, destructive rewrite of the event's content — typically used to satisfy GDPR
     * or other compliance erasure requirements. It is not a field-level mask.
     */
    redact(sequenceNumber: EventSequenceNumber, reason: string): Promise<void>;

    /**
     * Redacts all events for a specific event source, optionally filtered to specific event types.
     * @param eventSourceId - The event source identifier to redact events for.
     * @param reason - The reason for redacting the events.
     * @param eventTypes - Optional collection of event type constructors to limit the redaction to.
     * @returns A promise that resolves when the redaction has completed.
     * @remarks
     * This is a permanent, destructive rewrite of the events' content — typically used to satisfy GDPR
     * or other compliance erasure requirements. It is not a field-level mask.
     */
    redactForEventSource(eventSourceId: string, reason: string, eventTypes?: Constructor[]): Promise<void>;

    /**
     * Completes a stream so that no further events can be appended to it.
     * @param eventStreamType - The event stream type identifying the stream's type.
     * @param eventStreamId - The event stream identifier identifying the stream within the type.
     * @returns The tail sequence number at the moment of completion on success, or a typed error
     * describing why the operation was rejected.
     * @remarks
     * The default stream can never be completed and will return `DefaultStreamCannotBeCompleted`.
     * Completing an already-completed stream returns `AlreadyCompleted` and leaves the stream in its
     * completed state. After a successful completion any subsequent append targeting the same stream
     * results in a constraint violation of type `StreamClosed`.
     */
    completeStream(eventStreamType: string, eventStreamId: string): Promise<CompleteStreamResult>;
}
