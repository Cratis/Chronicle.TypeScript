// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { ChronicleConnection } from '../connection/index.js';
import { SpanStatusCode } from '@opentelemetry/api';
import type { AppendedEventResponse as ContractsAppendedEvent } from '@cratis/chronicle.contracts';
import { Constructor, Guid, JsonSerializer } from '@cratis/fundamentals';
import { getEventTypeFor } from '../events/eventTypeDecorator.js';
import type { AppendedEvent } from '../events/AppendedEvent.js';
import { toClientEventContext } from '../events/toClientEventContext.js';
import { Tag } from '../events/Tag.js';
import { getTagsFor } from '../events/tagDecorator.js';
import { mergeTags } from '../events/mergeTags.js';
import { DecoratorType } from '../types/DecoratorType.js';
import { TypeDiscoverer } from '../types/TypeDiscoverer.js';
import { toClientFailedPartition } from '../observation/toClientFailedPartition.js';
import { AppendedEventWithResult } from './AppendedEventWithResult.js';
import { AppendOperationsBroadcaster } from './AppendOperationsBroadcaster.js';
import { AppendOptions } from './AppendOptions.js';
import { AppendResult } from './AppendResult.js';
import { CompleteStreamError } from './CompleteStreamError.js';
import { CompleteStreamResult } from './CompleteStreamResult.js';
import { ConcurrencyViolation } from './ConcurrencyViolation.js';
import { ConstraintViolation } from './ConstraintViolation.js';
import { EventForEventSourceId } from './EventForEventSourceId.js';
import { IEventSequence } from './IEventSequence.js';
import { ITransactionalEventSequence } from './ITransactionalEventSequence.js';
import { EventSequenceId } from './EventSequenceId.js';
import { EventSequenceNumber } from './EventSequenceNumber.js';
import { TransactionalEventSequence } from './TransactionalEventSequence.js';
import { WaitForCompletionResult } from './WaitForCompletionResult.js';
import type { WaitForCompletionOptions } from './WaitForCompletionOptions.js';

/** Default timeout for {@link AppendResult.waitForCompletion}, matching the C# client's default. */
const DEFAULT_WAIT_FOR_COMPLETION_TIMEOUT_MS = 5000;
import { ChronicleTracer } from '../Tracing.js';
import { ChronicleMetrics } from '../Metrics.js';
import { identityProvider, Identity } from '../identity/index.js';
import { causationManager, CausationType } from '../auditing/index.js';
import { correlationIdManager } from '../correlation/index.js';
import { toContractsGuid } from '../connection/Guid.js';
import { ensureCommandResponse, ensureCommandSuccess, ensureQuerySuccess } from '../connection/callResults.js';
import type { ConcurrencyScope } from './ConcurrencyScope.js';
import { IUnitOfWorkManager } from '../transactions/IUnitOfWorkManager.js';

/**
 * Implements {@link IEventSequence} by communicating with the Chronicle Kernel
 * via gRPC using the {@link ChronicleConnection}.
 */
export class EventSequence implements IEventSequence {
    readonly transactional: ITransactionalEventSequence;
    readonly appendOperations = new AppendOperationsBroadcaster<AppendedEventWithResult[]>();

    constructor(
        readonly id: EventSequenceId,
        private readonly _eventStoreName: string,
        private readonly _namespace: string,
        private readonly _connection: ChronicleConnection,
        private readonly _unitOfWorkManager: IUnitOfWorkManager,
        private readonly _resolveConstraintMessage?: (violation: ConstraintViolation) => ConstraintViolation
    ) {
        this.transactional = new TransactionalEventSequence(this, this._unitOfWorkManager);
    }

    /** @inheritdoc */
    async append(eventSourceId: string, event: object, options?: AppendOptions): Promise<AppendResult> {
        const eventType = getEventTypeFor(event.constructor as Function);
        const correlationId = options?.correlationId === undefined
            ? Guid.as(correlationIdManager.current.value)
            : Guid.as(options.correlationId);
        const content = JsonSerializer.serialize(event);

        // Merge static tags declared on the event type with tags supplied at append time.
        const tags = mergeTags(getTagsFor(event.constructor as Function), options?.tags);

        const causationChain = causationManager.run(CausationType.appendEvent, { eventType: eventType.id.value },
            () => causationManager.getCurrentChain());
        const identity = identityProvider.getCurrent();

        const metricAttributes = {
            'chronicle.event_store': this._eventStoreName,
            'chronicle.namespace': this._namespace,
            'chronicle.event_sequence_id': this.id.value,
            'chronicle.event_type_id': eventType.id.value
        };

        return ChronicleTracer.startActiveSpan('chronicle.event_sequences.append', async span => {
            span.setAttribute('chronicle.event_store', this._eventStoreName);
            span.setAttribute('chronicle.namespace', this._namespace);
            span.setAttribute('chronicle.event_sequence_id', this.id.value);
            span.setAttribute('chronicle.event_source_id', eventSourceId);
            span.setAttribute('chronicle.event_type_id', eventType.id.value);
            span.setAttribute('chronicle.event_type_generation', eventType.generation.value);
            const startTime = Date.now();
            try {
                const response = await this._connection.eventSequences.append({
                    EventStore: this._eventStoreName,
                    Namespace: this._namespace,
                    EventSequenceId: this.id.value,
                    CorrelationId: toContractsGuid(correlationId),
                    EventSourceType: options?.sourceType,
                    EventSourceId: eventSourceId,
                    EventStreamType: options?.streamType,
                    EventStreamId: options?.streamId,
                    EventType: {
                        Id: eventType.id.value,
                        Generation: eventType.generation.value,
                        Tombstone: eventType.tombstone
                    },
                    Content: content,
                    Causation: causationChain.map(c => ({
                        Occurred: { Value: c.occurred.toISOString() },
                        Type: c.type.name,
                        Properties: { ...c.properties }
                    })),
                    CausedBy: toContractsCausedBy(identity),
                    ConcurrencyScope: this.toContractConcurrencyScope(options?.concurrencyScope),
                    Tags: tags,
                    Occurred: options?.occurred === undefined ? undefined : { Value: options.occurred.toISOString() },
                    Subject: options?.subject ?? eventSourceId
                });

                const appendResponse = ensureCommandResponse('append event', response);
                const duration = Date.now() - startTime;
                const result = this.mapAppendResponse(
                    appendResponse.SequenceNumber,
                    appendResponse.ConstraintViolations ?? [],
                    appendResponse.Errors ?? [],
                    appendResponse.ConcurrencyViolation
                );
                span.setAttribute('chronicle.sequence_number', result.sequenceNumber.value.toString());
                span.setStatus({ code: SpanStatusCode.OK });

                ChronicleMetrics.eventsAppended.add(1, metricAttributes);
                ChronicleMetrics.appendDuration.record(duration, metricAttributes);
                if (result.constraintViolations.length > 0) {
                    ChronicleMetrics.constraintViolations.add(result.constraintViolations.length, {
                        'chronicle.event_store': this._eventStoreName,
                        'chronicle.namespace': this._namespace,
                        'chronicle.event_sequence_id': this.id.value
                    });
                }
                if (result.errors.length > 0) {
                    ChronicleMetrics.appendErrors.add(result.errors.length, {
                        'chronicle.event_store': this._eventStoreName,
                        'chronicle.namespace': this._namespace,
                        'chronicle.event_sequence_id': this.id.value
                    });
                }

                if (this.appendOperations.hasSubscribers) {
                    this.appendOperations.publish([{
                        event: {
                            context: {
                                sequenceNumber: result.sequenceNumber.value,
                                eventSourceId,
                                eventType,
                                occurred: new Date(),
                                correlationId: correlationId.toString(),
                                causation: causationChain.map(c => ({ type: c.type.name, properties: { ...c.properties } })),
                                tags: tags.map(value => new Tag(value))
                            },
                            eventType,
                            content: event as Record<string, unknown>
                        },
                        result
                    }]);
                }

                return result;
            } catch (error) {
                span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
                span.recordException(error as Error);
                ChronicleMetrics.appendErrors.add(1, {
                    'chronicle.event_store': this._eventStoreName,
                    'chronicle.namespace': this._namespace,
                    'chronicle.event_sequence_id': this.id.value
                });
                throw error;
            } finally {
                span.end();
            }
        });
    }

    /** @inheritdoc */
    async appendMany(eventSourceId: string, events: object[], options?: AppendOptions): Promise<AppendResult[]>;
    async appendMany(events: EventForEventSourceId[], options?: AppendOptions): Promise<AppendResult[]>;
    async appendMany(
        eventSourceIdOrEvents: string | EventForEventSourceId[],
        eventsOrOptions?: object[] | AppendOptions,
        options?: AppendOptions
    ): Promise<AppendResult[]> {
        if (typeof eventSourceIdOrEvents !== 'string' && !Array.isArray(eventSourceIdOrEvents)) {
            throw new Error('Invalid arguments: first parameter must be an eventSourceId string or an array of { eventSourceId, event }.');
        }
        if (typeof eventSourceIdOrEvents === 'string' && !Array.isArray(eventsOrOptions)) {
            throw new Error('Invalid arguments: use appendMany(eventSourceId, events, options?) where the second parameter is an array of events.');
        }
        if (typeof eventSourceIdOrEvents !== 'string' && Array.isArray(eventsOrOptions)) {
            throw new Error('Invalid arguments: use appendMany(eventsForEventSourceId, options?) where the second parameter is append options.');
        }

        let eventsForEventSourceIds: EventForEventSourceId[];
        if (typeof eventSourceIdOrEvents === 'string') {
            const eventsArray = eventsOrOptions as object[];
            eventsForEventSourceIds = eventsArray.map((event: object) => ({
                eventSourceId: eventSourceIdOrEvents,
                event
            }));
        } else {
            eventsForEventSourceIds = eventSourceIdOrEvents;
        }
        const appendOptions = typeof eventSourceIdOrEvents === 'string'
            ? options
            : eventsOrOptions as AppendOptions | undefined;
        if (eventsForEventSourceIds.length === 0 && Object.keys(appendOptions?.concurrencyScopes ?? {}).length > 0) {
            throw new Error('Chronicle requires at least one event to validate concurrency scopes.');
        }

        const correlationId = appendOptions?.correlationId === undefined
            ? Guid.as(correlationIdManager.current.value)
            : Guid.as(appendOptions.correlationId);

        const batchCausationChain = causationManager.run(CausationType.appendManyEvents, { count: String(eventsForEventSourceIds.length) },
            () => causationManager.getCurrentChain());
        const identity = identityProvider.getCurrent();

        // Explicit labels may narrow a different event source than any target in this batch.
        // Preserve them and supply the shared fallback only for targets without an explicit scope.
        const concurrencyScopes = new Map<string, ConcurrencyScope | undefined>(Object.entries(appendOptions?.concurrencyScopes ?? {}));
        for (const { eventSourceId } of eventsForEventSourceIds) {
            if (!concurrencyScopes.has(eventSourceId)) {
                concurrencyScopes.set(eventSourceId, appendOptions?.concurrencyScope);
            }
        }

        const eventsToAppend = eventsForEventSourceIds.map(({ eventSourceId, event, eventStreamType, eventStreamId, eventSourceType, subject, occurred, tags: instanceTags }) => {
            const eventType = getEventTypeFor(event.constructor as Function);

            // Merge static tags declared on the event type, tags carried by this specific
            // EventForEventSourceId entry, and tags supplied at call time for the whole batch.
            const tags = mergeTags(getTagsFor(event.constructor as Function), instanceTags, appendOptions?.tags);
            const occurrenceTime = occurred ?? appendOptions?.occurred;

            return {
                EventSourceType: eventSourceType ?? appendOptions?.sourceType,
                EventSourceId: eventSourceId,
                EventStreamType: eventStreamType ?? appendOptions?.streamType,
                EventStreamId: eventStreamId ?? appendOptions?.streamId,
                EventType: {
                    Id: eventType.id.value,
                    Generation: eventType.generation.value,
                    Tombstone: eventType.tombstone
                },
                Content: JsonSerializer.serialize(event),
                Tags: tags,
                Occurred: occurrenceTime === undefined ? undefined : { Value: occurrenceTime.toISOString() },
                Subject: subject ?? appendOptions?.subject ?? eventSourceId
            };
        });

        const distinctEventSourceIds = [...new Set(eventsForEventSourceIds.map(_ => _.eventSourceId))];

        const batchMetricAttributes = {
            'chronicle.event_store': this._eventStoreName,
            'chronicle.namespace': this._namespace,
            'chronicle.event_sequence_id': this.id.value,
            'chronicle.events_count': eventsForEventSourceIds.length
        };

        return ChronicleTracer.startActiveSpan('chronicle.event_sequences.append_many', async span => {
            span.setAttribute('chronicle.event_store', this._eventStoreName);
            span.setAttribute('chronicle.namespace', this._namespace);
            span.setAttribute('chronicle.event_sequence_id', this.id.value);
            if (distinctEventSourceIds.length === 1) {
                span.setAttribute('chronicle.event_source_id', distinctEventSourceIds[0]);
            }
            span.setAttribute('chronicle.events_count', eventsForEventSourceIds.length);
            const startTime = Date.now();
            try {
                const response = await this._connection.eventSequences.appendManyForEventSources({
                    EventStore: this._eventStoreName,
                    Namespace: this._namespace,
                    EventSequenceId: this.id.value,
                    CorrelationId: toContractsGuid(correlationId),
                    Events: eventsToAppend,
                    Causation: batchCausationChain.map(c => ({
                        Occurred: { Value: c.occurred.toISOString() },
                        Type: c.type.name,
                        Properties: { ...c.properties }
                    })),
                    CausedBy: toContractsCausedBy(identity),
                    ConcurrencyScopes: [...concurrencyScopes].map(([eventSourceId, scope]) => ({
                        EventSourceId: eventSourceId,
                        Scope: this.toContractConcurrencyScope(scope)
                    }))
                });

                const appendManyResponse = ensureCommandResponse('append many events', response);
                const duration = Date.now() - startTime;
                // Mirrors the C# client: every per-event AppendResult in a batch carries all
                // constraint violations and the first concurrency violation of the whole batch —
                // the wire response doesn't correlate either back to a specific event index.
                const firstConcurrencyViolation = (appendManyResponse.ConcurrencyViolations ?? [])[0];
                const sequenceNumbers = appendManyResponse.SequenceNumbers ?? [];
                const constraintViolations = appendManyResponse.ConstraintViolations ?? [];
                const errors = appendManyResponse.Errors ?? [];
                const batchWasRejected = sequenceNumbers.length === 0 &&
                    (constraintViolations.length > 0 || errors.length > 0 || firstConcurrencyViolation !== undefined);
                if (sequenceNumbers.length === 0 && eventsForEventSourceIds.length > 0 && !batchWasRejected) {
                    throw new Error('Append many events returned no sequence numbers or rejection details.');
                }
                const result = batchWasRejected
                    ? eventsForEventSourceIds.map(() => this.mapAppendResponse(0n, constraintViolations, errors, firstConcurrencyViolation))
                    : sequenceNumbers.map((sequenceNumber: bigint, index: number) =>
                        this.mapAppendResponse(
                            sequenceNumber,
                            constraintViolations,
                            errors.filter((_: string, errorIndex: number) => errorIndex === index),
                            firstConcurrencyViolation
                        )
                    );
                span.setStatus({ code: SpanStatusCode.OK });

                ChronicleMetrics.batchAppendsPerformed.add(1, batchMetricAttributes);
                ChronicleMetrics.eventsAppended.add(eventsForEventSourceIds.length, batchMetricAttributes);
                ChronicleMetrics.appendManyDuration.record(duration, batchMetricAttributes);

                const totalViolations = result.reduce((sum: number, appendResult: AppendResult) => sum + appendResult.constraintViolations.length, 0);
                if (totalViolations > 0) {
                    ChronicleMetrics.constraintViolations.add(totalViolations, {
                        'chronicle.event_store': this._eventStoreName,
                        'chronicle.namespace': this._namespace,
                        'chronicle.event_sequence_id': this.id.value
                    });
                }
                const totalErrors = result.reduce((sum: number, appendResult: AppendResult) => sum + appendResult.errors.length, 0);
                if (totalErrors > 0) {
                    ChronicleMetrics.appendErrors.add(totalErrors, {
                        'chronicle.event_store': this._eventStoreName,
                        'chronicle.namespace': this._namespace,
                        'chronicle.event_sequence_id': this.id.value
                    });
                }

                if (this.appendOperations.hasSubscribers && result.length > 0) {
                    const occurredAt = new Date();
                    const causationEntries = batchCausationChain.map(c => ({ type: c.type.name, properties: { ...c.properties } }));
                    this.appendOperations.publish(result.map((appendResult: AppendResult, index: number) => {
                        const { eventSourceId, event } = eventsForEventSourceIds[index];
                        const eventType = getEventTypeFor(event.constructor as Function);
                        return {
                            event: {
                                context: {
                                    sequenceNumber: appendResult.sequenceNumber.value,
                                    eventSourceId,
                                    eventType,
                                    occurred: occurredAt,
                                    correlationId: correlationId.toString(),
                                    causation: causationEntries,
                                    tags: eventsToAppend[index].Tags.map(value => new Tag(value))
                                },
                                eventType,
                                content: event as Record<string, unknown>
                            },
                            result: appendResult
                        };
                    }));
                }

                return result;
            } catch (error) {
                span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
                span.recordException(error as Error);
                ChronicleMetrics.appendErrors.add(1, {
                    'chronicle.event_store': this._eventStoreName,
                    'chronicle.namespace': this._namespace,
                    'chronicle.event_sequence_id': this.id.value
                });
                throw error;
            } finally {
                span.end();
            }
        });
    }

    /** @inheritdoc */
    async getNextSequenceNumber(): Promise<EventSequenceNumber> {
        const tail = await this.getTailSequenceNumber();
        if (tail.value === EventSequenceNumber.unset.value) {
            return EventSequenceNumber.first;
        }
        return new EventSequenceNumber(tail.value + 1n);
    }

    /** @inheritdoc */
    async getTailSequenceNumber(
        eventSourceId?: string,
        eventSourceType?: string,
        eventStreamType?: string,
        eventStreamId?: string,
        filterEventTypes?: Constructor[]
    ): Promise<EventSequenceNumber> {
        return ChronicleTracer.startActiveSpan('chronicle.event_sequences.get_tail_sequence_number', async span => {
            span.setAttribute('chronicle.event_store', this._eventStoreName);
            span.setAttribute('chronicle.namespace', this._namespace);
            span.setAttribute('chronicle.event_sequence_id', this.id.value);
            if (eventSourceId !== undefined) {
                span.setAttribute('chronicle.event_source_id', eventSourceId);
            }
            try {
                const response = await this._connection.eventSequences.tailSequenceNumber({
                    EventStore: this._eventStoreName,
                    Namespace: this._namespace,
                    EventSequenceId: this.id.value,
                    EventSourceId: eventSourceId ?? '',
                    EventTypeIds: this.joinEventTypeIds(filterEventTypes ?? []),
                    // An unspecified route dimension must not narrow the read: appends without explicit
                    // routes are resolved by the kernel, so a 'Default' stream type would report the tail
                    // of the legacy stream instead of the sequence the next append continues.
                    EventSourceType: eventSourceType ?? '',
                    EventStreamId: eventStreamId ?? '',
                    EventStreamType: eventStreamType ?? ''
                });

                const data = ensureQuerySuccess('get tail sequence number', response);
                const result = new EventSequenceNumber(data?.SequenceNumber ?? 0n);
                span.setAttribute('chronicle.sequence_number', result.value.toString());
                span.setStatus({ code: SpanStatusCode.OK });
                return result;
            } catch (error) {
                span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
                span.recordException(error as Error);
                throw error;
            } finally {
                span.end();
            }
        });
    }

    /** @inheritdoc */
    async getTailSequenceNumberForObserver(observerType: Constructor): Promise<EventSequenceNumber> {
        const eventTypes = this.getEventTypesHandledBy(observerType);
        return this.getTailSequenceNumber(undefined, undefined, undefined, undefined, eventTypes);
    }

    /** @inheritdoc */
    async hasEventsFor(eventSourceId: string): Promise<boolean> {
        return ChronicleTracer.startActiveSpan('chronicle.event_sequences.has_events_for', async span => {
            span.setAttribute('chronicle.event_store', this._eventStoreName);
            span.setAttribute('chronicle.namespace', this._namespace);
            span.setAttribute('chronicle.event_sequence_id', this.id.value);
            span.setAttribute('chronicle.event_source_id', eventSourceId);
            try {
                const response = await this._connection.eventSequences.hasEventsForEventSourceId({
                    EventStore: this._eventStoreName,
                    Namespace: this._namespace,
                    EventSequenceId: this.id.value,
                    EventSourceId: eventSourceId
                });

                const result = ensureQuerySuccess('has events for event source', response)?.HasEvents ?? false;
                span.setAttribute('chronicle.has_events', result);
                span.setStatus({ code: SpanStatusCode.OK });
                return result;
            } catch (error) {
                span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
                span.recordException(error as Error);
                throw error;
            } finally {
                span.end();
            }
        });
    }

    /** @inheritdoc */
    async getForEventSourceIdAndEventTypes(
        eventSourceId: string,
        eventTypes: Constructor[],
        eventStreamType?: string,
        eventStreamId?: string,
        eventSourceType?: string
    ): Promise<AppendedEvent[]> {
        return ChronicleTracer.startActiveSpan('chronicle.event_sequences.get_for_event_source_id_and_event_types', async span => {
            span.setAttribute('chronicle.event_store', this._eventStoreName);
            span.setAttribute('chronicle.namespace', this._namespace);
            span.setAttribute('chronicle.event_sequence_id', this.id.value);
            span.setAttribute('chronicle.event_source_id', eventSourceId);
            try {
                const response = await this._connection.eventSequences.forEventSourceIdAndEventTypes({
                    EventStore: this._eventStoreName,
                    Namespace: this._namespace,
                    EventSequenceId: this.id.value,
                    EventSourceId: eventSourceId,
                    // An unspecified dimension must not narrow the read; a 'Default' stream type would
                    // hide every event the kernel routed for an append that carried no explicit route.
                    EventStreamType: eventStreamType ?? '',
                    EventStreamId: eventStreamId ?? '',
                    EventSourceType: eventSourceType ?? '',
                    EventTypeIds: this.joinEventTypeIds(eventTypes)
                });

                const result = ensureQuerySuccess('get events for event source id and event types', response).map(event => this.toClientAppendedEvent(event));
                span.setStatus({ code: SpanStatusCode.OK });
                return result;
            } catch (error) {
                span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
                span.recordException(error as Error);
                throw error;
            } finally {
                span.end();
            }
        });
    }

    /** @inheritdoc */
    async getFromSequenceNumber(
        sequenceNumber: EventSequenceNumber,
        eventSourceId?: string,
        filterEventTypes?: Constructor[]
    ): Promise<AppendedEvent[]> {
        return ChronicleTracer.startActiveSpan('chronicle.event_sequences.get_from_sequence_number', async span => {
            span.setAttribute('chronicle.event_store', this._eventStoreName);
            span.setAttribute('chronicle.namespace', this._namespace);
            span.setAttribute('chronicle.event_sequence_id', this.id.value);
            span.setAttribute('chronicle.sequence_number', sequenceNumber.value.toString());
            try {
                const response = await this._connection.eventSequences.fromSequenceNumber({
                    EventStore: this._eventStoreName,
                    Namespace: this._namespace,
                    EventSequenceId: this.id.value,
                    FromEventSequenceNumber: sequenceNumber.value,
                    EventSourceId: eventSourceId ?? '',
                    EventTypeIds: this.joinEventTypeIds(filterEventTypes ?? [])
                });

                const result = ensureQuerySuccess('get events from sequence number', response).map(event => this.toClientAppendedEvent(event));
                span.setStatus({ code: SpanStatusCode.OK });
                return result;
            } catch (error) {
                span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
                span.recordException(error as Error);
                throw error;
            } finally {
                span.end();
            }
        });
    }

    /** @inheritdoc */
    async redact(sequenceNumber: EventSequenceNumber, reason: string): Promise<void> {
        causationManager.add(CausationType.redact, { sequenceNumber: sequenceNumber.value.toString() });
        const causationChain = causationManager.getCurrentChain();
        const identity = identityProvider.getCurrent();

        return ChronicleTracer.startActiveSpan('chronicle.event_sequences.redact', async span => {
            span.setAttribute('chronicle.event_store', this._eventStoreName);
            span.setAttribute('chronicle.namespace', this._namespace);
            span.setAttribute('chronicle.event_sequence_id', this.id.value);
            span.setAttribute('chronicle.sequence_number', sequenceNumber.value.toString());
            try {
                ensureCommandSuccess('redact event', await this._connection.eventSequences.redact({
                    EventStore: this._eventStoreName,
                    Namespace: this._namespace,
                    EventSequenceId: this.id.value,
                    SequenceNumber: sequenceNumber.value,
                    Reason: reason,
                    Causation: causationChain.map(c => ({
                        Occurred: { Value: c.occurred.toISOString() },
                        Type: c.type.name,
                        Properties: { ...c.properties }
                    })),
                    CausedBy: toContractsCausedBy(identity)
                }));
                span.setStatus({ code: SpanStatusCode.OK });
            } catch (error) {
                span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
                span.recordException(error as Error);
                throw error;
            } finally {
                span.end();
            }
        });
    }

    /** @inheritdoc */
    async redactForEventSource(eventSourceId: string, reason: string, eventTypes?: Constructor[]): Promise<void> {
        causationManager.add(CausationType.redactForEventSource, { eventSourceId });
        const causationChain = causationManager.getCurrentChain();
        const identity = identityProvider.getCurrent();
        const wireEventTypeIds = (eventTypes ?? []).map(constructor => getEventTypeFor(constructor as unknown as Function).id.value);

        return ChronicleTracer.startActiveSpan('chronicle.event_sequences.redact_for_event_source', async span => {
            span.setAttribute('chronicle.event_store', this._eventStoreName);
            span.setAttribute('chronicle.namespace', this._namespace);
            span.setAttribute('chronicle.event_sequence_id', this.id.value);
            span.setAttribute('chronicle.event_source_id', eventSourceId);
            try {
                ensureCommandSuccess('redact event source', await this._connection.eventSequences.redactForEventSource({
                    EventStore: this._eventStoreName,
                    Namespace: this._namespace,
                    EventSequenceId: this.id.value,
                    EventSourceId: eventSourceId,
                    Reason: reason,
                    EventTypes: wireEventTypeIds,
                    Causation: causationChain.map(c => ({
                        Occurred: { Value: c.occurred.toISOString() },
                        Type: c.type.name,
                        Properties: { ...c.properties }
                    })),
                    CausedBy: toContractsCausedBy(identity)
                }));
                span.setStatus({ code: SpanStatusCode.OK });
            } catch (error) {
                span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
                span.recordException(error as Error);
                throw error;
            } finally {
                span.end();
            }
        });
    }

    /**
     * Resolves which registered event type classes a given observer (reactor/reducer) type handles,
     * using the same naming convention the observation runtimes use to dispatch events to handler
     * methods: an event type named `SomethingHappened` dispatches to a method named `somethingHappened`.
     */
    private getEventTypesHandledBy(observerType: Constructor): Constructor[] {
        const prototype = (observerType as unknown as Function).prototype as Record<string, unknown>;
        const eventTypeClasses = TypeDiscoverer.default.getTypesByDecoratorType(DecoratorType.EventType);

        return eventTypeClasses.filter(eventTypeClass => {
            const className = (eventTypeClass as unknown as Function).name;
            const methodName = className.charAt(0).toLowerCase() + className.slice(1);
            return typeof prototype[methodName] === 'function';
        });
    }

    /** @inheritdoc */
    async completeStream(eventStreamType: string, eventStreamId: string): Promise<CompleteStreamResult> {
        return ChronicleTracer.startActiveSpan('chronicle.event_sequences.complete_stream', async span => {
            span.setAttribute('chronicle.event_store', this._eventStoreName);
            span.setAttribute('chronicle.namespace', this._namespace);
            span.setAttribute('chronicle.event_sequence_id', this.id.value);
            span.setAttribute('chronicle.event_stream_type', eventStreamType);
            span.setAttribute('chronicle.event_stream_id', eventStreamId);
            try {
                const response = await this._connection.eventSequences.completeStream({
                    EventStore: this._eventStoreName,
                    Namespace: this._namespace,
                    EventSequenceId: this.id.value,
                    EventStreamType: eventStreamType,
                    EventStreamId: eventStreamId
                });

                const completeStreamResponse = ensureCommandResponse('complete stream', response);
                const result: CompleteStreamResult = completeStreamResponse.IsSuccess
                    ? { isSuccess: true, sequenceNumber: new EventSequenceNumber(completeStreamResponse.SequenceNumber ?? 0n) }
                    : { isSuccess: false, error: this.toClientCompleteStreamError(completeStreamResponse.Error) };

                span.setStatus({ code: SpanStatusCode.OK });
                return result;
            } catch (error) {
                span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
                span.recordException(error as Error);
                throw error;
            } finally {
                span.end();
            }
        });
    }

    private toClientCompleteStreamError(error: number): CompleteStreamError {
        // Mirrors the C# client's switch: any wire value other than DefaultStreamCannotBeCompleted
        // (including UNRECOGNIZED) is treated as AlreadyCompleted.
        return error === 1 ? CompleteStreamError.DefaultStreamCannotBeCompleted : CompleteStreamError.AlreadyCompleted;
    }

    private joinEventTypeIds(eventTypes: Constructor[]): string {
        return eventTypes.map(constructor => getEventTypeFor(constructor as unknown as Function).id.value).join(',');
    }

    private toClientAppendedEvent(wireEvent: ContractsAppendedEvent): AppendedEvent {
        const context = toClientEventContext(wireEvent.Context!);
        return {
            context,
            eventType: context.eventType,
            content: JSON.parse(wireEvent.Content) as Record<string, unknown>
        };
    }

    private mapAppendResponse(
        sequenceNumber: bigint,
        constraintViolations: Array<{ ConstraintId?: string; Message?: string; Details?: Record<string, string> }>,
        errors: string[],
        concurrencyViolation?: { EventSourceId?: string; ExpectedSequenceNumber?: bigint; ActualSequenceNumber?: bigint }
    ): AppendResult {
        const mappedViolations: ConstraintViolation[] = constraintViolations.map(violation => {
            const mapped = {
                constraintId: violation.ConstraintId ?? '',
                message: violation.Message ?? '',
                details: violation.Details ?? {}
            };
            return this._resolveConstraintMessage?.(mapped) ?? mapped;
        });

        const mappedErrors = errors.map(message => ({ message }));

        const mappedConcurrencyViolation: ConcurrencyViolation | undefined = concurrencyViolation
            ? {
                eventSourceId: concurrencyViolation.EventSourceId ?? '',
                expectedSequenceNumber: new EventSequenceNumber(concurrencyViolation.ExpectedSequenceNumber ?? 0n),
                actualSequenceNumber: new EventSequenceNumber(concurrencyViolation.ActualSequenceNumber ?? 0n)
            }
            : undefined;

        const safeSequenceNumber = sequenceNumber === 18446744073709551615n ? 0n : sequenceNumber;
        const eventSequenceNumber = new EventSequenceNumber(safeSequenceNumber);
        const isSuccess = mappedViolations.length === 0 && mappedErrors.length === 0 && !mappedConcurrencyViolation;

        return {
            sequenceNumber: eventSequenceNumber,
            constraintViolations: mappedViolations,
            concurrencyViolation: mappedConcurrencyViolation,
            errors: mappedErrors,
            isSuccess,
            waitForCompletion: (options?: number | WaitForCompletionOptions) => this.waitForObserverCompletion(eventSequenceNumber, isSuccess, options)
        };
    }

    /**
     * Waits for all observers affected by an append to either process up to the given tail sequence
     * number or fail. Backs {@link AppendResult.waitForCompletion}.
     */
    private async waitForObserverCompletion(
        tailSequenceNumber: EventSequenceNumber,
        appendWasSuccessful: boolean,
        options: number | WaitForCompletionOptions = DEFAULT_WAIT_FOR_COMPLETION_TIMEOUT_MS
    ): Promise<WaitForCompletionResult> {
        if (!appendWasSuccessful) {
            return { isSuccess: true, failedPartitions: [] };
        }

        const timeoutMs = typeof options === 'number' ? options : options.timeoutMs ?? DEFAULT_WAIT_FOR_COMPLETION_TIMEOUT_MS;
        const timeoutSignal = AbortSignal.timeout(timeoutMs);
        const signal = typeof options === 'number' || !options.signal
            ? timeoutSignal
            : AbortSignal.any([options.signal, timeoutSignal]);
        const response = await this._connection.observers.waitForCompletion(
            {
                EventStore: this._eventStoreName,
                Namespace: this._namespace,
                EventSequenceId: this.id.value,
                TailEventSequenceNumber: tailSequenceNumber.value
            },
            { signal });

        return {
            isSuccess: response.IsSuccess,
            failedPartitions: (response.FailedPartitions ?? []).map(failedPartition => toClientFailedPartition(failedPartition))
        };
    }

    private toContractConcurrencyScope(scope?: ConcurrencyScope) {
        return {
            SequenceNumber: scope?.sequenceNumber === EventSequenceNumber.beforeFirst.value
                ? EventSequenceNumber.unset.value
                : scope?.sequenceNumber ?? EventSequenceNumber.unset.value,
            ExpectsNoMatchingEvent: scope?.sequenceNumber === EventSequenceNumber.beforeFirst.value,
            EventSourceId: scope?.eventSourceId ?? false,
            EventStreamType: scope?.eventStreamType ?? '',
            EventStreamId: scope?.eventStreamId ?? '',
            EventSourceType: scope?.eventSourceType ?? '',
            EventTypes: (scope?.eventTypes ?? []).map(eventType => ({
                Id: eventType.id.value,
                Generation: eventType.generation.value,
                Tombstone: eventType.tombstone
            }))
        };
    }
}

/**
 * Converts an {@link Identity} into the CausedBy shape used by Chronicle contracts.
 * @param identity - The identity to convert.
 * @returns The contracts CausedBy object.
 */
function toContractsCausedBy(identity: Identity): object {
    const result: Record<string, unknown> = {
        Subject: identity.subject,
        Name: identity.name,
        UserName: identity.userName,
        OnBehalfOf: undefined
    };
    if (identity.onBehalfOf !== undefined) {
        result.OnBehalfOf = toContractsCausedBy(identity.onBehalfOf);
    }
    return result;
}
