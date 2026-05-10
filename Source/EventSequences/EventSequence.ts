// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import {
    ChronicleConnection,
    Guid as ContractsGuid
} from '../connection';
import { SpanStatusCode } from '@opentelemetry/api';
import { Guid } from '@cratis/fundamentals';
import { getEventTypeFor } from '../Events/eventTypeDecorator';
import { AppendOptions } from './AppendOptions';
import { AppendResult } from './AppendResult';
import { ConstraintViolation } from './ConstraintViolation';
import { IEventSequence } from './IEventSequence';
import { EventSequenceId } from './EventSequenceId';
import { EventSequenceNumber } from './EventSequenceNumber';
import { ChronicleTracer } from '../Tracing';
import { ChronicleMetrics } from '../Metrics';

/**
 * Implements {@link IEventSequence} by communicating with the Chronicle Kernel
 * via gRPC using the {@link ChronicleConnection}.
 */
export class EventSequence implements IEventSequence {
    constructor(
        readonly id: EventSequenceId,
        private readonly _eventStoreName: string,
        private readonly _namespace: string,
        private readonly _connection: ChronicleConnection
    ) {}

    /** @inheritdoc */
    async append(eventSourceId: string, event: object, options?: AppendOptions): Promise<AppendResult> {
        const eventType = getEventTypeFor(event.constructor as Function);
        const correlationId = options?.correlationId === undefined
            ? Guid.create()
            : Guid.as(options.correlationId);
        const content = JSON.stringify(event);

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
                    Causation: [{
                        Occurred: { Value: new Date().toISOString() },
                        Type: 'TypeScriptClient.Append',
                        Properties: {}
                    }],
                    CausedBy: {
                        Subject: '5d032c92-9d5e-41eb-947a-ee5314ed0032',
                        Name: '[System]',
                        UserName: '[System]',
                        OnBehalfOf: undefined
                    },
                    ConcurrencyScope: {
                        // ulong.MaxValue sent as BigInt so the server recognises it as ConcurrencyScope.None (no validation)
                        SequenceNumber: 18446744073709551615n as unknown as number,
                        EventSourceId: false,
                        EventStreamType: '',
                        EventStreamId: '',
                        EventSourceType: '',
                        EventTypes: []
                    },
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
                span.setAttribute('chronicle.sequence_number', result.sequenceNumber.value);
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
    async appendMany(eventSourceId: string, events: object[], options?: AppendOptions): Promise<AppendResult[]> {
        const correlationId = options?.correlationId === undefined
            ? Guid.create()
            : Guid.as(options.correlationId);

        const eventsToAppend = events.map(event => {
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
                Content: JSON.stringify(event),
                Causation: [{
                    Occurred: { Value: new Date().toISOString() },
                    Type: 'TypeScriptClient.AppendMany.Event',
                    Properties: {}
                }],
                CausedBy: {
                    Subject: '5d032c92-9d5e-41eb-947a-ee5314ed0032',
                    Name: '[System]',
                    UserName: '[System]',
                    OnBehalfOf: undefined
                },
                ConcurrencyScope: {
                    SequenceNumber: 18446744073709551615n as unknown as number,
                    EventSourceId: false,
                    EventStreamType: '',
                    EventStreamId: '',
                    EventSourceType: '',
                    EventTypes: []
                },
                Tags: [],
                Occurred: undefined,
                Subject: eventSourceId
            };
        });

        const batchMetricAttributes = {
            'chronicle.event_store': this._eventStoreName,
            'chronicle.namespace': this._namespace,
            'chronicle.event_sequence_id': this.id.value,
            'chronicle.events_count': events.length
        };

        return ChronicleTracer.startActiveSpan('chronicle.event_sequences.append_many', async span => {
            span.setAttribute('chronicle.event_store', this._eventStoreName);
            span.setAttribute('chronicle.namespace', this._namespace);
            span.setAttribute('chronicle.event_sequence_id', this.id.value);
            span.setAttribute('chronicle.event_source_id', eventSourceId);
            span.setAttribute('chronicle.events_count', events.length);
            const startTime = Date.now();
            try {
                const response = await this._connection.eventSequences.appendMany({
                    EventStore: this._eventStoreName,
                    Namespace: this._namespace,
                    EventSequenceId: this.id.value,
                    CorrelationId: toContractsGuid(correlationId),
                    Events: eventsToAppend,
                    Causation: [{
                        Occurred: { Value: new Date().toISOString() },
                        Type: 'TypeScriptClient.AppendMany.Batch',
                        Properties: {}
                    }],
                    CausedBy: {
                        Subject: '5d032c92-9d5e-41eb-947a-ee5314ed0032',
                        Name: '[System]',
                        UserName: '[System]',
                        OnBehalfOf: undefined
                    },
                    ConcurrencyScopes: {}
                });

                const duration = Date.now() - startTime;
                const result = (response.SequenceNumbers ?? []).map((sequenceNumber, index) =>
                    this.mapAppendResponse(
                        sequenceNumber,
                        response.ConstraintViolations ?? [],
                        (response.Errors ?? []).filter((_, errorIndex) => errorIndex === index)
                    )
                );
                span.setStatus({ code: SpanStatusCode.OK });

                ChronicleMetrics.batchAppendsPerformed.add(1, batchMetricAttributes);
                ChronicleMetrics.eventsAppended.add(events.length, batchMetricAttributes);
                ChronicleMetrics.appendManyDuration.record(duration, batchMetricAttributes);

                const totalViolations = result.reduce((sum, appendResult) => sum + appendResult.constraintViolations.length, 0);
                if (totalViolations > 0) {
                    ChronicleMetrics.constraintViolations.add(totalViolations, {
                        'chronicle.event_store': this._eventStoreName,
                        'chronicle.namespace': this._namespace,
                        'chronicle.event_sequence_id': this.id.value
                    });
                }
                const totalErrors = result.reduce((sum, appendResult) => sum + appendResult.errors.length, 0);
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

                const result = new EventSequenceNumber(response.SequenceNumber ?? 0);
                span.setAttribute('chronicle.sequence_number', result.value);
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

    private mapAppendResponse(
        sequenceNumber: number,
        constraintViolations: Array<{ ConstraintId?: string; Message?: string; Details?: Record<string, string> }>,
        errors: string[]
    ): AppendResult {
        const mappedViolations: ConstraintViolation[] = constraintViolations.map(violation => ({
            constraintId: violation.ConstraintId ?? '',
            message: violation.Message ?? '',
            details: violation.Details ?? {}
        }));

        const mappedErrors = errors.map(message => ({ message }));

        // The server uses ulong.MaxValue as a sentinel for "Unavailable" when an
        // append fails (constraint violation, etc.). JS Number loses precision at
        // that scale so we normalise anything >= MAX_SAFE_INTEGER to 0.
        const safeSequenceNumber = sequenceNumber >= Number.MAX_SAFE_INTEGER ? 0 : sequenceNumber;

        return {
            sequenceNumber: new EventSequenceNumber(safeSequenceNumber),
            constraintViolations: mappedViolations,
            errors: mappedErrors,
            isSuccess: mappedViolations.length === 0 && mappedErrors.length === 0
        };
    }
}

/**
 * Converts a RFC 4122 Guid string into the protobuf Guid shape used by Chronicle contracts.
 * @param guid - The Guid to convert.
 * @returns The converted protobuf Guid with fixed64-safe hi/lo values.
 */
function toContractsGuid(guid: Guid): ContractsGuid {
    const hex = guid.toString().replace(/-/g, '');
    const hi = BigInt(`0x${hex.substring(0, 16)}`);
    const lo = BigInt(`0x${hex.substring(16, 32)}`);

    // Mask to MAX_SAFE_INTEGER so the contracts package can decode the Guid
    // from the response without a longToNumber overflow. Correlation IDs are
    // opaque identifiers, so 52+52 bits of entropy is more than sufficient.
    const safe = BigInt(Number.MAX_SAFE_INTEGER);
    return {
        hi: Number(hi & safe),
        lo: Number(lo & safe)
    };
}

