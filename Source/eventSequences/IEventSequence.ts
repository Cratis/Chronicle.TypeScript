// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Constructor } from '@cratis/fundamentals';
import type { Guid } from '../connection/Guid.js';
import type { AppendedEvent } from '../events/AppendedEvent.js';
import type { IEventImport } from '../imports/IEventImport.js';
import type { ImportOptions } from '../imports/ImportOptions.js';
import type { ImportResult } from '../imports/ImportResult.js';
import { AppendedEventWithResult } from './AppendedEventWithResult.js';
import { AppendOptions } from './AppendOptions.js';
import { CompensateOptions } from './CompensateOptions.js';
import { CompleteStreamResult } from './CompleteStreamResult.js';
import { EventForEventSourceId } from './EventForEventSourceId.js';
import { AppendResult } from './AppendResult.js';
import { EventSequenceId } from './EventSequenceId.js';
import { EventSequenceNumber } from './EventSequenceNumber.js';
import { ITransactionalEventSequence } from './ITransactionalEventSequence.js';

/**
 * Defines the API surface for an event sequence.
 */
export interface IEventSequence {
    /** The unique identifier of this event sequence. */
    readonly id: EventSequenceId;

    /** Transactional append operations for this event sequence. */
    readonly transactional: ITransactionalEventSequence;

    /**
     * A hot, multicast async iterable that yields the events appended through this specific
     * {@link IEventSequence} instance, together with their result, after each {@link append} or
     * {@link appendMany} call completes (whether it succeeded or failed). A single-event append
     * yields an array of one element; a batch append yields the full batch.
     * @remarks
     * This does not fire for transactional appends through `transactional`. Values are only
     * published while at least one consumer is iterating — there is no replay buffer, so a
     * consumer that starts iterating after an append misses it.
     */
    readonly appendOperations: AsyncIterable<AppendedEventWithResult[]>;

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
     * Imports events into the event sequence through a resumable import session.
     * @param events - The events, in the order they are to be committed. They are read lazily as they are uploaded,
     * so the whole source is never held in memory.
     * @param options - Optional {@link ImportOptions}, including an `AbortSignal` that cancels the import and an
     * `onProgress` callback.
     * @returns The {@link ImportResult}.
     * @remarks
     * Every event is validated before any is committed. With the default `OnInvalidEvent.Reject` an import with an
     * invalid event commits nothing and reports the event by its index. Each event keeps its occurrence time,
     * correlation, caused-by identity, subject, tags and generation, and gets a new sequence number.
     * @throws {@link ImportsNotSupported} when the kernel does not serve imports.
     */
    import(events: AsyncIterable<EventForEventSourceId> | Iterable<EventForEventSourceId>, options?: ImportOptions): Promise<ImportResult>;

    /**
     * Begins an explicit import session, for producers that are not a single stream.
     * @param options - Optional {@link ImportOptions}.
     * @returns The {@link IEventImport} to add events to and complete.
     */
    beginImport(options?: ImportOptions): Promise<IEventImport>;

    /**
     * Reattaches to an import session by its identifier, to continue after the chunks the kernel already acknowledged.
     * @param importId - The identifier of the import.
     * @param options - Optional {@link ImportOptions}; the import keeps the `onInvalid` it began with.
     * @returns The {@link IEventImport}; its `eventsAcknowledged` says how many events to skip.
     */
    beginImport(importId: string | Guid, options?: ImportOptions): Promise<IEventImport>;

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
     * @remarks
     * An omitted dimension does not narrow the read - it is not the legacy `Default` route. The kernel
     * resolves an append that carried no route to source type `Default`, stream type `All`, and stream
     * identifier `Default`, so narrowing to `Default` would hide those events. Pass every dimension
     * explicitly to scope the read to a single stream.
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
     * @param eventStreamType - Optional event stream type to narrow to. Omitted does not narrow.
     * @param eventStreamId - Optional event stream identifier to narrow to. Omitted does not narrow.
     * @param eventSourceType - Optional event source type to filter by.
     * @returns A collection of appended events.
     * @remarks
     * An omitted dimension does not narrow the read - it is not the legacy `Default` route. The kernel
     * resolves an append that carried no route to source type `Default`, stream type `All` and stream
     * identifier `Default`, so narrowing to `Default` would hide those events.
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
     * Appends a compensating event that offsets an earlier event in this sequence.
     * The compensation is appended to the event source, event stream and subject of the compensated event,
     * so none of them are given. The event type of the compensation must be declared with `@compensationFor`
     * for the type of the compensated event.
     * @param compensationFor - The sequence number of the event to compensate for.
     * @param event - The compensation event instance.
     * @param options - Optional correlation identifier, tags and occurred time. Routing options are not used.
     * @returns The append result. A rejected compensation, such as a missing compensated event or an event type
     * that does not compensate for the type of the compensated event, is reported in `errors`.
     */
    compensate(compensationFor: EventSequenceNumber, event: object, options?: CompensateOptions): Promise<AppendResult>;

    /**
     * Copies the events of one event source onto another event source in this sequence, by starting a durable kernel job.
     * The copies are appended to the target event source with the original event context preserved by the kernel.
     * @param sourceId - The event source identifier to copy events from.
     * @param targetId - The event source identifier to copy events onto.
     * @param eventTypes - Event type constructors to limit the copy to; when none are given, events of every type are copied.
     * @returns A promise that resolves with the identifier of the started copy job once the kernel has accepted the request.
     * Resolving does not mean the copy has finished.
     * @throws ChronicleCallFailed When the kernel rejects the request.
     */
    copy(sourceId: string, targetId: string, ...eventTypes: Constructor[]): Promise<Guid>;

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
