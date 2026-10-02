// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { ChronicleConnection } from '../connection/index.js';
import { SpanStatusCode, type Span } from '@opentelemetry/api';
import type {
    AppendedEventResponse as ContractsAppendedEvent,
    AppendManyResponse as ContractsAppendManyResponse,
    AppendResponse as ContractsAppendResponse
} from '@cratis/chronicle.contracts';
import { Constructor } from '@cratis/fundamentals';
import { prepareSingleAppend } from './prepareSingleAppend.js';
import { prepareBatchAppend } from './prepareBatchAppend.js';
import { createAppendNotification, mapAppendNotificationCausation } from './createAppendNotification.js';
import { getEventTypeFor } from '../events/eventTypeDecorator.js';
import type { AppendedEvent } from '../events/AppendedEvent.js';
import { toClientEventContext } from '../events/toClientEventContext.js';
import { DecoratorType } from '../types/DecoratorType.js';
import { TypeDiscoverer } from '../types/TypeDiscoverer.js';
import { toClientFailedPartition } from '../observation/toClientFailedPartition.js';
import { AppendedEventWithResult } from './AppendedEventWithResult.js';
import { AppendOperationsBroadcaster } from './AppendOperationsBroadcaster.js';
import { AppendOptions } from './AppendOptions.js';
import { AppendResult } from './AppendResult.js';
import { createAppendResult } from './createAppendResult.js';
import { CompleteStreamError } from './CompleteStreamError.js';
import { CompleteStreamResult } from './CompleteStreamResult.js';
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
import { observeOperation } from '../telemetry/observeOperation.js';
import { setTelemetryAttribute, setEventSourceId, setSequenceNumber, recordSafeException } from '../telemetry/spanAttributes.js';
import type { ChronicleTelemetryOptions } from '../telemetry/ChronicleTelemetryOptions.js';
import { WellKnownTelemetryNames as names } from '../WellKnownTelemetryNames.js';
import { ChronicleMetrics } from '../Metrics.js';
import { identityProvider, Identity } from '../identity/index.js';
import { causationManager, CausationType } from '../auditing/index.js';
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
        private readonly _resolveConstraintMessage?: (violation: ConstraintViolation) => ConstraintViolation,
        private readonly _telemetry?: ChronicleTelemetryOptions
    ) {
        this.transactional = new TransactionalEventSequence(this, this._unitOfWorkManager);
    }

    /** @inheritdoc */
    async append(eventSourceId: string, event: object, options?: AppendOptions): Promise<AppendResult> {
        const { eventType, correlationId, content, tags, causationChain, identity } = prepareSingleAppend(event, options);

        const metricAttributes = {
            'chronicle.event_store': this._eventStoreName,
            'chronicle.namespace': this._namespace,
            'chronicle.event_sequence_id': this.id.value,
            'chronicle.event_type_id': eventType.id.value
        };

        return observeOperation('append', async span => {
            this.setSequenceAttributes(span);
            setEventSourceId(span, eventSourceId, this._telemetry);
            setTelemetryAttribute(span, 'eventTypeId', eventType.id.value);
            setTelemetryAttribute(span, 'eventTypeGeneration', eventType.generation.value);
            if (options?.sourceType) span.setAttribute(names.attributes.eventSourceType, options.sourceType);
            const startTime = performance.now();
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
                const duration = performance.now() - startTime;
                const result = this.mapAppendResponse(
                    appendResponse.SequenceNumber,
                    appendResponse.ConstraintViolations ?? [],
                    appendResponse.Errors ?? [],
                    appendResponse.ConcurrencyViolation
                );
                setSequenceNumber(span, result.sequenceNumber.value);
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
                    this.appendOperations.publish([createAppendNotification(eventSourceId, event, result,
                        correlationId.toString(), mapAppendNotificationCausation(causationChain), tags)]);
                }

                return result;
            } catch (error) {
                recordSafeException(span, error);
                ChronicleMetrics.appendErrors.add(1, {
                    'chronicle.event_store': this._eventStoreName,
                    'chronicle.namespace': this._namespace,
                    'chronicle.event_sequence_id': this.id.value
                });
                throw error;
            } finally {
                span.end();
            }
        }, correlationId);
    }

    /** @inheritdoc */
    async appendMany(eventSourceId: string, events: object[], options?: AppendOptions): Promise<AppendResult[]>;
    async appendMany(events: EventForEventSourceId[], options?: AppendOptions): Promise<AppendResult[]>;
    async appendMany(
        eventSourceIdOrEvents: string | EventForEventSourceId[],
        eventsOrOptions?: object[] | AppendOptions,
        options?: AppendOptions
    ): Promise<AppendResult[]> {
        const { eventsForEventSourceIds, correlationId, batchCausationChain, identity, concurrencyScopes, eventsToAppend } =
            prepareBatchAppend(eventSourceIdOrEvents, eventsOrOptions, options);

        const distinctEventSourceIds = [...new Set(eventsForEventSourceIds.map(_ => _.eventSourceId))];

        const batchMetricAttributes = {
            'chronicle.event_store': this._eventStoreName,
            'chronicle.namespace': this._namespace,
            'chronicle.event_sequence_id': this.id.value,
            'chronicle.events_count': eventsForEventSourceIds.length
        };

        return observeOperation('appendMany', async span => {
            this.setSequenceAttributes(span);
            if (distinctEventSourceIds.length === 1) {
                setEventSourceId(span, distinctEventSourceIds[0], this._telemetry);
            }
            setTelemetryAttribute(span, 'eventCount', eventsForEventSourceIds.length);
            const startTime = performance.now();
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
                const duration = performance.now() - startTime;
                // Mirrors the C# client: every per-event AppendResult in a batch carries all
                // constraint violations and the first concurrency violation of the whole batch —
                // the wire response doesn't correlate either back to a specific event index.
                const firstConcurrencyViolation: ContractsAppendManyResponse['ConcurrencyViolations'][number] | undefined =
                    (appendManyResponse.ConcurrencyViolations ?? [])[0];
                const sequenceNumbers: ContractsAppendManyResponse['SequenceNumbers'] = appendManyResponse.SequenceNumbers ?? [];
                const constraintViolations: ContractsAppendManyResponse['ConstraintViolations'] = appendManyResponse.ConstraintViolations ?? [];
                const errors: ContractsAppendManyResponse['Errors'] = appendManyResponse.Errors ?? [];
                const batchWasRejected = sequenceNumbers.length === 0 &&
                    (constraintViolations.length > 0 || errors.length > 0 || firstConcurrencyViolation !== undefined);
                if (sequenceNumbers.length === 0 && eventsForEventSourceIds.length > 0 && !batchWasRejected) {
                    throw new Error('Append many events returned no sequence numbers or rejection details.');
                }
                const result = batchWasRejected
                    ? eventsForEventSourceIds.map(() => this.mapAppendResponse(0n, constraintViolations, errors, firstConcurrencyViolation))
                    : sequenceNumbers.map((sequenceNumber, index) =>
                        this.mapAppendResponse(
                            sequenceNumber,
                            constraintViolations,
                            errors.filter((_, errorIndex) => errorIndex === index),
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
                    const causationEntries = mapAppendNotificationCausation(batchCausationChain);
                    this.appendOperations.publish(result.map((appendResult: AppendResult, index: number) => {
                        const { eventSourceId, event } = eventsForEventSourceIds[index];
                        return createAppendNotification(eventSourceId, event, appendResult, correlationId.toString(),
                            causationEntries, eventsToAppend[index].Tags, occurredAt);
                    }));
                }

                return result;
            } catch (error) {
                recordSafeException(span, error);
                ChronicleMetrics.appendErrors.add(1, {
                    'chronicle.event_store': this._eventStoreName,
                    'chronicle.namespace': this._namespace,
                    'chronicle.event_sequence_id': this.id.value
                });
                throw error;
            } finally {
                span.end();
            }
        }, correlationId);
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
        return observeOperation('getTailSequenceNumber', async span => {
            this.setSequenceAttributes(span);
            setEventSourceId(span, eventSourceId, this._telemetry);
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
                setSequenceNumber(span, result.value);
                span.setStatus({ code: SpanStatusCode.OK });
                return result;
            } catch (error) {
                recordSafeException(span, error);
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
        return observeOperation('hasEventsFor', async span => {
            this.setSequenceAttributes(span);
            setEventSourceId(span, eventSourceId, this._telemetry);
            try {
                const response = await this._connection.eventSequences.hasEventsForEventSourceId({
                    EventStore: this._eventStoreName,
                    Namespace: this._namespace,
                    EventSequenceId: this.id.value,
                    EventSourceId: eventSourceId
                });

                const result = ensureQuerySuccess('has events for event source', response)?.HasEvents ?? false;
                setTelemetryAttribute(span, 'hasEvents', result);
                span.setStatus({ code: SpanStatusCode.OK });
                return result;
            } catch (error) {
                recordSafeException(span, error);
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
        return observeOperation('getForEventSourceIdAndEventTypes', async span => {
            this.setSequenceAttributes(span);
            setEventSourceId(span, eventSourceId, this._telemetry);
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
                recordSafeException(span, error);
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
        return observeOperation('getFromSequenceNumber', async span => {
            this.setSequenceAttributes(span);
            setSequenceNumber(span, sequenceNumber.value);
            setEventSourceId(span, eventSourceId, this._telemetry);
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
                recordSafeException(span, error);
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

        return observeOperation('redact', async span => {
            this.setSequenceAttributes(span);
            setSequenceNumber(span, sequenceNumber.value);
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
                recordSafeException(span, error);
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

        return observeOperation('redactForEventSource', async span => {
            this.setSequenceAttributes(span);
            setEventSourceId(span, eventSourceId, this._telemetry);
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
                recordSafeException(span, error);
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
        return observeOperation('completeStream', async span => {
            this.setSequenceAttributes(span);
            setTelemetryAttribute(span, 'eventStreamType', eventStreamType);
            setTelemetryAttribute(span, 'eventStreamId', eventStreamId);
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
                recordSafeException(span, error);
                throw error;
            } finally {
                span.end();
            }
        });
    }

    private setSequenceAttributes(span: Span): void {
        setTelemetryAttribute(span, 'eventStore', this._eventStoreName);
        setTelemetryAttribute(span, 'namespace', this._namespace);
        setTelemetryAttribute(span, 'eventSequenceId', this.id.value);
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
        sequenceNumber: ContractsAppendResponse['SequenceNumber'],
        constraintViolations: ContractsAppendResponse['ConstraintViolations'],
        errors: ContractsAppendResponse['Errors'],
        concurrencyViolation: ContractsAppendResponse['ConcurrencyViolation']
    ): AppendResult {
        return createAppendResult(sequenceNumber, constraintViolations, errors, concurrencyViolation,
            this._resolveConstraintMessage, (sequence, success, options) => this.waitForObserverCompletion(sequence, success, options));
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
        const callerSignal = typeof options === 'number' ? undefined : options.signal;
        if (callerSignal?.aborted) throw callerSignal.reason;

        const controller = new AbortController();
        const forwardAbort = () => controller.abort(callerSignal?.reason);
        callerSignal?.addEventListener('abort', forwardAbort, { once: true });
        const timer = setTimeout(() => controller.abort(new DOMException('The operation was aborted due to timeout', 'TimeoutError')), timeoutMs);
        try {
            const response = await this._connection.observers.waitForCompletion(
                {
                    EventStore: this._eventStoreName,
                    Namespace: this._namespace,
                    EventSequenceId: this.id.value,
                    TailEventSequenceNumber: tailSequenceNumber.value
                },
                { signal: controller.signal });

            return {
                isSuccess: response.IsSuccess,
                failedPartitions: (response.FailedPartitions ?? []).map(failedPartition => toClientFailedPartition(failedPartition))
            };
        } finally {
            clearTimeout(timer);
            callerSignal?.removeEventListener('abort', forwardAbort);
        }
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
