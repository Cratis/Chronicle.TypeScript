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
import type { PreparedBatchAppend } from './PreparedBatchAppend.js';
import type { PreparedSingleAppend } from './PreparedSingleAppend.js';
import type { WireBatchEvent } from './WireBatchEvent.js';
import { toContractsCausation } from './toContractsCausation.js';
import { createAppendNotification, mapAppendNotificationCausation } from './createAppendNotification.js';
import { getEventTypeFor } from '../events/eventTypeDecorator.js';
import type { AppendedEvent } from '../events/AppendedEvent.js';
import type { NamedTag } from '../events/NamedTag.js';
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
import { ChronicleConventionMetrics } from '../Metrics.js';
import { identityProvider, Identity } from '../identity/index.js';
import { causationManager, CausationType } from '../auditing/index.js';
import { toContractsGuid } from '../connection/Guid.js';
import { ensureCommandResponse, ensureCommandSuccess, ensureQuerySuccess, type CallResultLike } from '../connection/callResults.js';
import type { ConcurrencyScope } from './ConcurrencyScope.js';
import type { IEventSources } from '../eventSources/IEventSources.js';
import { deriveConcurrencyScope, planDerivedGuards, resolveBatchRouting, resolveSingleRouting } from './resolveEventSourceRouting.js';
import { IUnitOfWorkManager } from '../transactions/IUnitOfWorkManager.js';
import { ensureNamedTagBatchIsSupported } from './ensureNamedTagBatchIsSupported.js';

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
        private readonly _telemetry?: ChronicleTelemetryOptions,
        private readonly _eventSources?: IEventSources
    ) {
        this.transactional = new TransactionalEventSequence(this, this._unitOfWorkManager);
    }

    /** @inheritdoc */
    async append(eventSourceId: string, event: object, options?: AppendOptions): Promise<AppendResult> {
        const routing = resolveSingleRouting(this._eventSources, options);
        const prepared = prepareSingleAppend(event, options);
        const { eventType, correlationId, tags, namedTags, causationChain } = prepared;

        const sequenceMetricAttributes = this.sequenceMetricAttributes;
        const metricAttributes = { ...sequenceMetricAttributes, [names.attributes.eventTypeId]: eventType.id.value };

        return observeOperation('append', async span => {
            this.setSequenceAttributes(span);
            setEventSourceId(span, eventSourceId, this._telemetry);
            setTelemetryAttribute(span, 'eventTypeId', eventType.id.value);
            setTelemetryAttribute(span, 'eventTypeGeneration', eventType.generation.value);
            if (options?.sourceType) span.setAttribute(names.attributes.eventSourceType, options.sourceType);
            const startTime = performance.now();
            try {
                const response = await this.sendAppend(eventSourceId, prepared, routing, options);

                const appendResponse = ensureCommandResponse('append event', response);
                const durationInSeconds = (performance.now() - startTime) / 1000;
                const result = this.mapAppendResponse(
                    appendResponse.SequenceNumber,
                    appendResponse.ConstraintViolations ?? [],
                    appendResponse.Errors ?? [],
                    appendResponse.ConcurrencyViolation
                );
                setSequenceNumber(span, result.sequenceNumber.value);
                span.setStatus({ code: SpanStatusCode.OK });

                this.recordAppendMetrics(result, durationInSeconds, metricAttributes, sequenceMetricAttributes);

                if (this.appendOperations.hasSubscribers) {
                    this.appendOperations.publish([createAppendNotification(eventSourceId, event, result,
                        correlationId.toString(), mapAppendNotificationCausation(causationChain), tags, undefined, namedTags)]);
                }

                return result;
            } catch (error) {
                recordSafeException(span, error);
                ChronicleConventionMetrics.appendErrors.add(1, sequenceMetricAttributes);
                throw error;
            } finally {
                span.end();
            }
        }, correlationId);
    }

    private get sequenceMetricAttributes(): Record<string, string> {
        return {
            [names.attributes.eventStore]: this._eventStoreName,
            [names.attributes.namespace]: this._namespace,
            [names.attributes.eventSequenceId]: this.id.value
        };
    }

    private async sendAppend(
        eventSourceId: string,
        prepared: PreparedSingleAppend,
        routing: ReturnType<typeof resolveSingleRouting>,
        options?: AppendOptions
    ) {
        const concurrencyScope = options?.concurrencyScope ?? (routing
            ? await deriveConcurrencyScope(routing, eventSourceId, options?.streamId, this.tailReader)
            : undefined);
        const request = this.createAppendRequest(eventSourceId, prepared, concurrencyScope, this.toAppendRouteFields(routing, options));
        // Named tags travel on the dedicated call so a kernel without support rejects them instead of dropping them.
        return prepared.namedTags.length === 0
            ? await this._connection.eventSequences.append(request)
            : await this._connection.eventSequences.appendWithNamedTags({ ...request, NamedTags: toContractsNamedTags(prepared.namedTags) });
    }

    private toAppendRouteFields(routing: ReturnType<typeof resolveSingleRouting>, options?: AppendOptions) {
        return {
            EventSourceType: routing?.sourceType ?? options?.sourceType,
            EventStreamType: routing?.streamType ?? options?.streamType,
            EventStreamId: options?.streamId,
            EventSource: routing?.eventSource,
            Occurred: toContractsOccurred(options?.occurred)
        };
    }

    private createAppendRequest(
        eventSourceId: string,
        { eventType, correlationId, content, tags, causationChain, identity, subject }: PreparedSingleAppend,
        concurrencyScope: ConcurrencyScope | undefined,
        routeFields: ReturnType<EventSequence['toAppendRouteFields']>
    ) {
        return {
            EventStore: this._eventStoreName,
            Namespace: this._namespace,
            EventSequenceId: this.id.value,
            CorrelationId: toContractsGuid(correlationId),
            EventSourceId: eventSourceId,
            EventType: {
                Id: eventType.id.value,
                Generation: eventType.generation.value,
                Tombstone: eventType.tombstone
            },
            Content: content,
            Causation: toContractsCausation(causationChain),
            CausedBy: toContractsCausedBy(identity),
            ConcurrencyScope: this.toContractConcurrencyScope(concurrencyScope),
            Tags: tags,
            Subject: subject ?? eventSourceId,
            ...routeFields
        };
    }

    private recordAppendMetrics(
        result: AppendResult,
        durationInSeconds: number,
        metricAttributes: Record<string, string>,
        sequenceMetricAttributes: Record<string, string>
    ): void {
        ChronicleConventionMetrics.eventsAppended.add(1, metricAttributes);
        ChronicleConventionMetrics.appendDuration.record(durationInSeconds, metricAttributes);
        if (result.constraintViolations.length > 0) {
            ChronicleConventionMetrics.constraintViolations.add(result.constraintViolations.length, sequenceMetricAttributes);
        }
        if (result.errors.length > 0) {
            ChronicleConventionMetrics.appendErrors.add(result.errors.length, sequenceMetricAttributes);
        }
    }

    /** @inheritdoc */
    async appendMany(eventSourceId: string, events: object[], options?: AppendOptions): Promise<AppendResult[]>;
    async appendMany(events: EventForEventSourceId[], options?: AppendOptions): Promise<AppendResult[]>;
    async appendMany(
        eventSourceIdOrEvents: string | EventForEventSourceId[],
        eventsOrOptions?: object[] | AppendOptions,
        options?: AppendOptions
    ): Promise<AppendResult[]> {
        const prepared = prepareBatchAppend(eventSourceIdOrEvents, eventsOrOptions, options);
        const { eventsForEventSourceIds, appendOptions, correlationId, concurrencyScopes, eventsToAppend, namedTags } = prepared;

        const wireEvents: WireBatchEvent[] = eventsToAppend;
        const routings = eventsForEventSourceIds.map(event => resolveBatchRouting(this._eventSources, event, appendOptions));
        ensureNamedTagBatchIsSupported(namedTags.some(tagsForEvent => tagsForEvent.length > 0), routings.some(routing => routing !== undefined));
        const explicitIds = new Set([...concurrencyScopes].filter(([, scope]) => scope !== undefined).map(([id]) => id));
        const derivedGuards = planDerivedGuards(routings, eventsForEventSourceIds, appendOptions?.streamId, explicitIds);
        const distinctEventSourceIds = [...new Set(eventsForEventSourceIds.map(_ => _.eventSourceId))];

        const batchMetricAttributes = this.sequenceMetricAttributes;

        return observeOperation('appendMany', async span => {
            this.setSequenceAttributes(span);
            if (distinctEventSourceIds.length === 1) {
                setEventSourceId(span, distinctEventSourceIds[0], this._telemetry);
            }
            setTelemetryAttribute(span, 'eventCount', eventsForEventSourceIds.length);
            const startTime = performance.now();
            try {
                this.applyBatchRouting(wireEvents, routings);
                for (const [id, { routing, streamId }] of derivedGuards) {
                    concurrencyScopes.set(id, await deriveConcurrencyScope(routing, id, streamId, this.tailReader));
                }
                const response = await this.sendAppendMany(prepared, wireEvents);

                const appendManyResponse = ensureCommandResponse('append many events', response);
                const durationInSeconds = (performance.now() - startTime) / 1000;
                const result = this.toAppendManyResults(appendManyResponse, eventsForEventSourceIds.length);
                span.setStatus({ code: SpanStatusCode.OK });

                this.recordAppendManyMetrics(result, eventsForEventSourceIds.length, durationInSeconds, batchMetricAttributes);
                this.publishAppendMany(prepared, result);

                return result;
            } catch (error) {
                recordSafeException(span, error);
                ChronicleConventionMetrics.appendErrors.add(1, batchMetricAttributes);
                throw error;
            } finally {
                span.end();
            }
        }, correlationId);
    }

    private applyBatchRouting(wireEvents: WireBatchEvent[], routings: ReturnType<typeof resolveBatchRouting>[]): void {
        routings.forEach((routing, index) => {
            if (!routing) return;
            wireEvents[index] = {
                ...wireEvents[index],
                EventSourceType: routing.sourceType,
                EventStreamType: routing.streamType ?? wireEvents[index].EventStreamType,
                EventSource: routing.eventSource
            };
        });
    }

    private async sendAppendMany(
        { correlationId, batchCausationChain, identity, concurrencyScopes, namedTags }: PreparedBatchAppend,
        wireEvents: WireBatchEvent[]
    ) {
        const request = {
            EventStore: this._eventStoreName,
            Namespace: this._namespace,
            EventSequenceId: this.id.value,
            CorrelationId: toContractsGuid(correlationId),
            Events: wireEvents,
            Causation: toContractsCausation(batchCausationChain),
            CausedBy: toContractsCausedBy(identity),
            ConcurrencyScopes: [...concurrencyScopes].map(([eventSourceId, scope]) => ({
                EventSourceId: eventSourceId,
                Scope: this.toContractConcurrencyScope(scope)
            }))
        };
        return namedTags.every(tagsForEvent => tagsForEvent.length === 0)
            ? await this._connection.eventSequences.appendManyForEventSources(request)
            : await this._connection.eventSequences.appendManyForEventSourcesWithNamedTags({
                ...request,
                Events: wireEvents.map((wireEvent, index) => ({ ...wireEvent, NamedTags: toContractsNamedTags(namedTags[index]) }))
            });
    }

    private toAppendManyResults(appendManyResponse: ContractsAppendManyResponse, eventCount: number): AppendResult[] {
        // Mirrors the C# client: every per-event AppendResult in a batch carries all
        // constraint violations and the first concurrency violation of the whole batch —
        // the wire response doesn't correlate either back to a specific event index.
        const firstConcurrencyViolation: ContractsAppendManyResponse['ConcurrencyViolations'][number] | undefined =
            (appendManyResponse.ConcurrencyViolations ?? [])[0];
        const sequenceNumbers: ContractsAppendManyResponse['SequenceNumbers'] = appendManyResponse.SequenceNumbers ?? [];
        const constraintViolations: ContractsAppendManyResponse['ConstraintViolations'] = appendManyResponse.ConstraintViolations ?? [];
        const errors: ContractsAppendManyResponse['Errors'] = appendManyResponse.Errors ?? [];
        if (sequenceNumbers.length === 0) {
            const hasRejectionDetails = constraintViolations.length > 0 || errors.length > 0 || firstConcurrencyViolation !== undefined;
            if (hasRejectionDetails) {
                return Array.from({ length: eventCount }, () => this.mapAppendResponse(0n, constraintViolations, errors, firstConcurrencyViolation));
            }
            if (eventCount > 0) {
                throw new Error('Append many events returned no sequence numbers or rejection details.');
            }
        }
        return sequenceNumbers.map((sequenceNumber, index) =>
            this.mapAppendResponse(
                sequenceNumber,
                constraintViolations,
                errors.filter((_, errorIndex) => errorIndex === index),
                firstConcurrencyViolation
            )
        );
    }

    private recordAppendManyMetrics(
        result: AppendResult[],
        eventCount: number,
        durationInSeconds: number,
        batchMetricAttributes: Record<string, string>
    ): void {
        ChronicleConventionMetrics.batchAppendsPerformed.add(1, batchMetricAttributes);
        ChronicleConventionMetrics.eventsAppended.add(eventCount, batchMetricAttributes);
        ChronicleConventionMetrics.appendManyDuration.record(durationInSeconds, batchMetricAttributes);

        const totalViolations = result.reduce((sum: number, appendResult: AppendResult) => sum + appendResult.constraintViolations.length, 0);
        if (totalViolations > 0) {
            ChronicleConventionMetrics.constraintViolations.add(totalViolations, batchMetricAttributes);
        }
        const totalErrors = result.reduce((sum: number, appendResult: AppendResult) => sum + appendResult.errors.length, 0);
        if (totalErrors > 0) {
            ChronicleConventionMetrics.appendErrors.add(totalErrors, batchMetricAttributes);
        }
    }

    private publishAppendMany(
        { eventsForEventSourceIds, correlationId, batchCausationChain, eventsToAppend, namedTags }: PreparedBatchAppend,
        result: AppendResult[]
    ): void {
        if (!this.appendOperations.hasSubscribers || result.length === 0) return;

        const occurredAt = new Date();
        const causationEntries = mapAppendNotificationCausation(batchCausationChain);
        this.appendOperations.publish(result.map((appendResult: AppendResult, index: number) => {
            const { eventSourceId, event } = eventsForEventSourceIds[index];
            return createAppendNotification(eventSourceId, event, appendResult, correlationId.toString(),
                causationEntries, eventsToAppend[index].Tags, occurredAt, namedTags[index]);
        }));
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

        return this.sendRedaction('redact', 'redact event',
            span => setSequenceNumber(span, sequenceNumber.value),
            causedBy => this._connection.eventSequences.redact({
                EventStore: this._eventStoreName,
                Namespace: this._namespace,
                EventSequenceId: this.id.value,
                SequenceNumber: sequenceNumber.value,
                Reason: reason,
                ...causedBy
            }));
    }

    /** @inheritdoc */
    async redactForEventSource(eventSourceId: string, reason: string, eventTypes?: Constructor[]): Promise<void> {
        causationManager.add(CausationType.redactForEventSource, { eventSourceId });
        const wireEventTypeIds = (eventTypes ?? []).map(constructor => getEventTypeFor(constructor as unknown as Function).id.value);

        return this.sendRedaction('redactForEventSource', 'redact event source',
            span => setEventSourceId(span, eventSourceId, this._telemetry),
            causedBy => this._connection.eventSequences.redactForEventSource({
                EventStore: this._eventStoreName,
                Namespace: this._namespace,
                EventSequenceId: this.id.value,
                EventSourceId: eventSourceId,
                Reason: reason,
                EventTypes: wireEventTypeIds,
                ...causedBy
            }));
    }

    private async sendRedaction(
        operationName: 'redact' | 'redactForEventSource',
        description: string,
        describeSpan: (span: Span) => void,
        send: (causedBy: { Causation: ReturnType<typeof toContractsCausation>; CausedBy: object }) => Promise<CallResultLike>
    ): Promise<void> {
        const causedBy = {
            Causation: toContractsCausation(causationManager.getCurrentChain()),
            CausedBy: toContractsCausedBy(identityProvider.getCurrent())
        };

        return observeOperation(operationName, async span => {
            this.setSequenceAttributes(span);
            describeSpan(span);
            try {
                ensureCommandSuccess(description, await send(causedBy));
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

        const { timeoutMs, callerSignal } = this.resolveWaitOptions(options);
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

    private resolveWaitOptions(options: number | WaitForCompletionOptions): { timeoutMs: number; callerSignal: AbortSignal | undefined } {
        if (typeof options === 'number') return { timeoutMs: options, callerSignal: undefined };
        return { timeoutMs: options.timeoutMs ?? DEFAULT_WAIT_FOR_COMPLETION_TIMEOUT_MS, callerSignal: options.signal };
    }

    private readonly tailReader = (source?: string, sourceType?: string, streamType?: string, streamId?: string) =>
        this.getTailSequenceNumber(source, sourceType, streamType, streamId);

    private toContractConcurrencyScope(scope?: ConcurrencyScope) {
        const expectsNoMatchingEvent = scope?.sequenceNumber === EventSequenceNumber.beforeFirst.value;
        return {
            SequenceNumber: expectsNoMatchingEvent
                ? EventSequenceNumber.unset.value
                : scope?.sequenceNumber ?? EventSequenceNumber.unset.value,
            ExpectsNoMatchingEvent: expectsNoMatchingEvent,
            EventSourceId: scope?.eventSourceId ?? false,
            EventStreamType: scope?.eventStreamType ?? '',
            EventStreamId: scope?.eventStreamId ?? '',
            EventSourceType: scope?.eventSourceType ?? '',
            EventTypes: toContractsEventTypes(scope)
        };
    }
}

/**
 * Converts an optional occurrence time into the contracts timestamp shape.
 * @param occurred - The occurrence time, if any.
 * @returns The contracts timestamp, or undefined when no time was given.
 */
function toContractsOccurred(occurred: Date | undefined): { Value: string } | undefined {
    return occurred === undefined ? undefined : { Value: occurred.toISOString() };
}

/**
 * Converts the event types of a concurrency scope into the contracts shape.
 * @param scope - The concurrency scope, if any.
 * @returns The contracts event types.
 */
function toContractsEventTypes(scope: ConcurrencyScope | undefined) {
    return (scope?.eventTypes ?? []).map(eventType => ({
        Id: eventType.id.value,
        Generation: eventType.generation.value,
        Tombstone: eventType.tombstone
    }));
}

/**
 * Converts structured named tags into the sequence contract shape.
 * @param namedTags - The validated named tags.
 * @returns The wire named tags.
 */
function toContractsNamedTags(namedTags: readonly NamedTag[]): { Name: string; Value: string }[] {
    return namedTags.map(tag => ({ Name: tag.name, Value: tag.value }));
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
