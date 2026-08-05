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
import { AppendOptions } from './AppendOptions';
import { AppendResult } from './AppendResult';
import { ConstraintViolation } from './ConstraintViolation';
import { EventForEventSourceId } from './EventForEventSourceId';
import { IEventSequence } from './IEventSequence';
import { ITransactionalEventSequence } from './ITransactionalEventSequence';
import { EventSequenceId } from './EventSequenceId';
import { EventSequenceNumber } from './EventSequenceNumber';
import { TransactionalEventSequence } from './TransactionalEventSequence';
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
                    response.Errors ?? []
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
        const concurrencyScope = this.toContractConcurrencyScope(appendOptions?.concurrencyScope);

        const eventsToAppend = eventsForEventSourceIds.map(({ eventSourceId, event }) => {
            const eventType = getEventTypeFor(event.constructor as Function);
            return {
                EventSourceType: 'Default',
                EventSourceId: eventSourceId,
                EventStreamType: 'Default',
                EventStreamId: eventSourceId,
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
                ConcurrencyScope: concurrencyScope,
                Tags: [],
                Occurred: undefined,
                Subject: eventSourceId
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
                        ...Object.fromEntries(distinctEventSourceIds.map(eventSourceId => [eventSourceId, concurrencyScope]))
                    }
                });

                const duration = Date.now() - startTime;
                const result = (response.SequenceNumbers ?? []).map((sequenceNumber: bigint, index: number) =>
                    this.mapAppendResponse(
                        sequenceNumber,
                        response.ConstraintViolations ?? [],
                        (response.Errors ?? []).filter((_: string, errorIndex: number) => errorIndex === index)
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
    async getTailSequenceNumber(eventSourceId?: string): Promise<EventSequenceNumber> {
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
                    EventTypes: [],
                    EventSourceType: 'Default',
                    EventStreamId: '',
                    EventStreamType: 'Default'
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
        errors: string[]
    ): AppendResult {
        const mappedViolations: ConstraintViolation[] = constraintViolations.map(violation => ({
            constraintId: violation.ConstraintId ?? '',
            message: violation.Message ?? '',
            details: violation.Details ?? {}
        }));

        const mappedErrors = errors.map(message => ({ message }));

        const safeSequenceNumber = sequenceNumber === 18446744073709551615n ? 0n : sequenceNumber;

        return {
            sequenceNumber: new EventSequenceNumber(safeSequenceNumber),
            constraintViolations: mappedViolations,
            errors: mappedErrors,
            isSuccess: mappedViolations.length === 0 && mappedErrors.length === 0
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
