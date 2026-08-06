// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { ChronicleConnection } from '../connection';
import { SpanStatusCode } from '@opentelemetry/api';
import type { AppendedEvent as ContractsAppendedEvent } from '@cratis/chronicle.contracts';
import { Constructor, Guid, JsonSerializer } from '@cratis/fundamentals';
import { getEventTypeFor } from '../events/eventTypeDecorator';
import type { AppendedEvent } from '../events/AppendedEvent';
import { EventType } from '../events/EventType';
import { EventTypeId } from '../events/EventTypeId';
import { EventTypeGeneration } from '../events/EventTypeGeneration';
import { DecoratorType } from '../types/DecoratorType';
import { TypeDiscoverer } from '../types/TypeDiscoverer';
import { toClientFailedPartition } from '../observation/toClientFailedPartition';
import { AppendedEventWithResult } from './AppendedEventWithResult';
import { AppendOperationsBroadcaster } from './AppendOperationsBroadcaster';
import { AppendOptions } from './AppendOptions';
import { AppendResult } from './AppendResult';
import { CompleteStreamError } from './CompleteStreamError';
import { CompleteStreamResult } from './CompleteStreamResult';
import { ConcurrencyViolation } from './ConcurrencyViolation';
import { ConstraintViolation } from './ConstraintViolation';
import { EventForEventSourceId } from './EventForEventSourceId';
import { IEventSequence } from './IEventSequence';
import { ITransactionalEventSequence } from './ITransactionalEventSequence';
import { EventSequenceId } from './EventSequenceId';
import { EventSequenceNumber } from './EventSequenceNumber';
import { TransactionalEventSequence } from './TransactionalEventSequence';
import { WaitForCompletionResult } from './WaitForCompletionResult';

/** Default timeout for {@link AppendResult.waitForCompletion}, matching the C# client's default. */
const DEFAULT_WAIT_FOR_COMPLETION_TIMEOUT_MS = 5000;
import { ChronicleTracer } from '../Tracing';
import { ChronicleMetrics } from '../Metrics';
import { identityProvider, Identity } from '../identity';
import { causationManager, CausationType } from '../auditing';
import { correlationIdManager } from '../correlation';
import { fromContractsGuid, toContractsGuid } from '../connection/Guid';
import type { ConcurrencyScope } from './ConcurrencyScope';
import { IUnitOfWorkManager } from '../transactions/IUnitOfWorkManager';

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
        private readonly _unitOfWorkManager: IUnitOfWorkManager
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

        causationManager.add(CausationType.appendEvent, { eventType: eventType.id.value });
        const causationChain = causationManager.getCurrentChain();
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
                    EventSourceType: 'Default',
                    EventSourceId: eventSourceId,
                    EventStreamType: 'Default',
                    EventStreamId: eventSourceId,
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
                    Tags: [],
                    Occurred: undefined,
                    Subject: eventSourceId
                });

                const duration = Date.now() - startTime;
                const result = this.mapAppendResponse(
                    response.SequenceNumber,
                    response.ConstraintViolations ?? [],
                    response.Errors ?? [],
                    response.ConcurrencyViolation
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
                                causation: causationChain.map(c => ({ type: c.type.name, properties: { ...c.properties } }))
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

        const correlationId = appendOptions?.correlationId === undefined
            ? Guid.as(correlationIdManager.current.value)
            : Guid.as(appendOptions.correlationId);

        causationManager.add(CausationType.appendManyEvents, { count: String(eventsForEventSourceIds.length) });
        const batchCausationChain = causationManager.getCurrentChain();
        const identity = identityProvider.getCurrent();

        // Each distinct event source id in the batch gets its own concurrency scope: an explicit
        // entry in options.concurrencyScopes wins, falling back to the shared options.concurrencyScope
        // when no per-source entry is given — mirroring C#'s AppendMany(IEnumerable<EventForEventSourceId>, ...)
        // overload, which takes an IDictionary<EventSourceId, ConcurrencyScope> rather than one shared scope.
        const concurrencyScopesByEventSourceId = appendOptions?.concurrencyScopes;
        const defaultConcurrencyScope = appendOptions?.concurrencyScope;
        const resolveConcurrencyScope = (eventSourceId: string) =>
            this.toContractConcurrencyScope(concurrencyScopesByEventSourceId?.[eventSourceId] ?? defaultConcurrencyScope);

        const eventsToAppend = eventsForEventSourceIds.map(({ eventSourceId, event, eventStreamType, eventStreamId, eventSourceType, subject }) => {
            const eventType = getEventTypeFor(event.constructor as Function);
            return {
                EventSourceType: eventSourceType ?? 'Default',
                EventSourceId: eventSourceId,
                EventStreamType: eventStreamType ?? 'Default',
                EventStreamId: eventStreamId ?? eventSourceId,
                EventType: {
                    Id: eventType.id.value,
                    Generation: eventType.generation.value,
                    Tombstone: eventType.tombstone
                },
                Content: JsonSerializer.serialize(event),
                Causation: batchCausationChain.map(c => ({
                    Occurred: { Value: c.occurred.toISOString() },
                    Type: c.type.name,
                    Properties: { ...c.properties }
                })),
                CausedBy: toContractsCausedBy(identity),
                Tags: [],
                Occurred: undefined,
                Subject: subject ?? eventSourceId
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
                const response = await this._connection.eventSequences.appendMany({
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
                    ConcurrencyScopes: {
                        ...Object.fromEntries(distinctEventSourceIds.map(eventSourceId => [eventSourceId, resolveConcurrencyScope(eventSourceId)]))
                    }
                });

                const duration = Date.now() - startTime;
                // Mirrors the C# client: every per-event AppendResult in a batch carries all
                // constraint violations and the first concurrency violation of the whole batch —
                // the wire response doesn't correlate either back to a specific event index.
                const firstConcurrencyViolation = (response.ConcurrencyViolations ?? [])[0];
                const result = (response.SequenceNumbers ?? []).map((sequenceNumber: bigint, index: number) =>
                    this.mapAppendResponse(
                        sequenceNumber,
                        response.ConstraintViolations ?? [],
                        (response.Errors ?? []).filter((_: string, errorIndex: number) => errorIndex === index),
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
                                    causation: causationEntries
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
                const response = await this._connection.eventSequences.getTailSequenceNumber({
                    EventStore: this._eventStoreName,
                    Namespace: this._namespace,
                    EventSequenceId: this.id.value,
                    EventSourceId: eventSourceId ?? '',
                    EventTypes: this.toContractEventTypes(filterEventTypes ?? []),
                    EventSourceType: eventSourceType ?? 'Default',
                    EventStreamId: eventStreamId ?? '',
                    EventStreamType: eventStreamType ?? 'Default'
                });

                const result = new EventSequenceNumber(response.SequenceNumber ?? 0n);
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

                const result = response.HasEvents ?? false;
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
                const response = await this._connection.eventSequences.getForEventSourceIdAndEventTypes({
                    EventStore: this._eventStoreName,
                    Namespace: this._namespace,
                    EventSequenceId: this.id.value,
                    EventSourceType: eventSourceType ?? 'Default',
                    EventSourceId: eventSourceId,
                    EventStreamType: eventStreamType ?? 'Default',
                    EventStreamId: eventStreamId ?? '',
                    EventTypes: this.toContractEventTypes(eventTypes)
                });

                const result = (response.Events ?? []).map(event => this.toClientAppendedEvent(event));
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
                const response = await this._connection.eventSequences.getEventsFromEventSequenceNumber({
                    EventStore: this._eventStoreName,
                    Namespace: this._namespace,
                    EventSequenceId: this.id.value,
                    FromEventSequenceNumber: sequenceNumber.value,
                    ToEventSequenceNumber: 0n,
                    EventSourceId: eventSourceId ?? '',
                    EventTypes: this.toContractEventTypes(filterEventTypes ?? [])
                });

                const result = (response.Events ?? []).map(event => this.toClientAppendedEvent(event));
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
        const correlationId = Guid.as(correlationIdManager.current.value);

        return ChronicleTracer.startActiveSpan('chronicle.event_sequences.redact', async span => {
            span.setAttribute('chronicle.event_store', this._eventStoreName);
            span.setAttribute('chronicle.namespace', this._namespace);
            span.setAttribute('chronicle.event_sequence_id', this.id.value);
            span.setAttribute('chronicle.sequence_number', sequenceNumber.value.toString());
            try {
                await this._connection.eventSequences.redact({
                    EventStore: this._eventStoreName,
                    Namespace: this._namespace,
                    EventSequenceId: this.id.value,
                    SequenceNumber: sequenceNumber.value,
                    Reason: reason,
                    CorrelationId: toContractsGuid(correlationId),
                    Causation: causationChain.map(c => ({
                        Occurred: { Value: c.occurred.toISOString() },
                        Type: c.type.name,
                        Properties: { ...c.properties }
                    })),
                    CausedBy: toContractsCausedBy(identity)
                });
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
        const correlationId = Guid.as(correlationIdManager.current.value);
        const wireEventTypes = (eventTypes ?? []).map(constructor => {
            const eventType = getEventTypeFor(constructor as unknown as Function);
            return {
                Id: eventType.id.value,
                Generation: eventType.generation.value,
                Tombstone: eventType.tombstone
            };
        });

        return ChronicleTracer.startActiveSpan('chronicle.event_sequences.redact_for_event_source', async span => {
            span.setAttribute('chronicle.event_store', this._eventStoreName);
            span.setAttribute('chronicle.namespace', this._namespace);
            span.setAttribute('chronicle.event_sequence_id', this.id.value);
            span.setAttribute('chronicle.event_source_id', eventSourceId);
            try {
                await this._connection.eventSequences.redactForEventSource({
                    EventStore: this._eventStoreName,
                    Namespace: this._namespace,
                    EventSequenceId: this.id.value,
                    EventSourceId: eventSourceId,
                    Reason: reason,
                    EventTypes: wireEventTypes,
                    CorrelationId: toContractsGuid(correlationId),
                    Causation: causationChain.map(c => ({
                        Occurred: { Value: c.occurred.toISOString() },
                        Type: c.type.name,
                        Properties: { ...c.properties }
                    })),
                    CausedBy: toContractsCausedBy(identity)
                });
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

                const result: CompleteStreamResult = response.IsSuccess
                    ? { isSuccess: true, sequenceNumber: new EventSequenceNumber(response.SequenceNumber ?? 0n) }
                    : { isSuccess: false, error: this.toClientCompleteStreamError(response.Error) };

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

    private toContractEventTypes(eventTypes: Constructor[]) {
        return eventTypes.map(constructor => {
            const eventType = getEventTypeFor(constructor as unknown as Function);
            return {
                Id: eventType.id.value,
                Generation: eventType.generation.value,
                Tombstone: eventType.tombstone
            };
        });
    }

    private toClientAppendedEvent(wireEvent: ContractsAppendedEvent): AppendedEvent {
        const context = wireEvent.Context!;
        const eventType = new EventType(
            new EventTypeId(context.EventType?.Id ?? ''),
            new EventTypeGeneration(context.EventType?.Generation ?? EventTypeGeneration.firstValue),
            context.EventType?.Tombstone ?? false
        );

        return {
            context: {
                sequenceNumber: context.SequenceNumber,
                eventSourceId: context.EventSourceId,
                eventType,
                occurred: new Date(context.Occurred?.Value ?? ''),
                correlationId: fromContractsGuid(context.CorrelationId).toString(),
                causation: (context.Causation ?? []).map(c => ({
                    type: c.Type,
                    properties: { ...c.Properties }
                }))
            },
            eventType,
            content: JSON.parse(wireEvent.Content) as Record<string, unknown>
        };
    }

    private mapAppendResponse(
        sequenceNumber: bigint,
        constraintViolations: Array<{ ConstraintId?: string; Message?: string; Details?: Record<string, string> }>,
        errors: string[],
        concurrencyViolation?: { EventSourceId?: string; ExpectedSequenceNumber?: bigint; ActualSequenceNumber?: bigint }
    ): AppendResult {
        const mappedViolations: ConstraintViolation[] = constraintViolations.map(violation => ({
            constraintId: violation.ConstraintId ?? '',
            message: violation.Message ?? '',
            details: violation.Details ?? {}
        }));

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
            waitForCompletion: (timeoutMs?: number) => this.waitForObserverCompletion(eventSequenceNumber, isSuccess, timeoutMs)
        };
    }

    /**
     * Waits for all observers affected by an append to either process up to the given tail sequence
     * number or fail. Backs {@link AppendResult.waitForCompletion}.
     */
    private async waitForObserverCompletion(
        tailSequenceNumber: EventSequenceNumber,
        appendWasSuccessful: boolean,
        timeoutMs = DEFAULT_WAIT_FOR_COMPLETION_TIMEOUT_MS
    ): Promise<WaitForCompletionResult> {
        if (!appendWasSuccessful) {
            return { isSuccess: true, failedPartitions: [] };
        }

        const response = await this._connection.observers.waitForCompletion(
            {
                EventStore: this._eventStoreName,
                Namespace: this._namespace,
                EventSequenceId: this.id.value,
                TailEventSequenceNumber: tailSequenceNumber.value
            },
            { signal: AbortSignal.timeout(timeoutMs) });

        return {
            isSuccess: response.IsSuccess,
            failedPartitions: (response.FailedPartitions ?? []).map(failedPartition => toClientFailedPartition(failedPartition))
        };
    }

    private toContractConcurrencyScope(scope?: ConcurrencyScope) {
        return {
            SequenceNumber: scope?.sequenceNumber ?? EventSequenceNumber.unset.value,
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
 * Converts a RFC 4122 Guid string into the protobuf Guid shape used by Chronicle contracts.
 * @param guid - The Guid to convert.
 * @returns The converted protobuf Guid with fixed64-safe hi/lo values.
 */

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
