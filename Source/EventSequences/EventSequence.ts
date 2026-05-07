// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { ChronicleConnection, AppendResponse, AppendManyResponse, GetTailSequenceNumberResponse, HasEventsForEventSourceIdResponse } from '@cratis/chronicle.contracts';
import { getEventTypeFor } from '../Events/eventTypeDecorator';
import { Grpc } from '../Grpc';
import { uuidToGuid, newUuid } from '../Uuid';
import { AppendOptions, IEventSequence } from './IEventSequence';
import { AppendResult, ConstraintViolation } from './AppendResult';
import { EventSequenceId } from './EventSequenceId';
import { EventSequenceNumber } from './EventSequenceNumber';

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
        const correlationId = options?.correlationId ?? newUuid();
        const content = JSON.stringify(event);

        const response = await Grpc.call<AppendResponse>(callback =>
            this._connection.eventSequences.append(
                {
                    EventStore: this._eventStoreName,
                    Namespace: this._namespace,
                    EventSequenceId: this.id.value,
                    CorrelationId: uuidToGuid(correlationId),
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
                    Causation: [],
                    CausedBy: undefined,
                    ConcurrencyScope: undefined,
                    Tags: [],
                    Occurred: undefined,
                    Subject: eventSourceId
                },
                callback
            )
        );

        return this.mapAppendResponse(
            response.SequenceNumber,
            response.ConstraintViolations ?? [],
            response.Errors ?? []
        );
    }

    /** @inheritdoc */
    async appendMany(eventSourceId: string, events: object[], options?: AppendOptions): Promise<AppendResult[]> {
        const correlationId = options?.correlationId ?? newUuid();

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
                Causation: [],
                CausedBy: undefined,
                ConcurrencyScope: undefined,
                Tags: [],
                Occurred: undefined,
                Subject: eventSourceId
            };
        });

        const response = await Grpc.call<AppendManyResponse>(callback =>
            this._connection.eventSequences.appendMany(
                {
                    EventStore: this._eventStoreName,
                    Namespace: this._namespace,
                    EventSequenceId: this.id.value,
                    CorrelationId: uuidToGuid(correlationId),
                    Events: eventsToAppend,
                    Causation: [],
                    CausedBy: undefined,
                    ConcurrencyScopes: {}
                },
                callback
            )
        );

        return (response.SequenceNumbers ?? []).map((sequenceNumber: number, index: number) =>
            this.mapAppendResponse(
                sequenceNumber,
                response.ConstraintViolations ?? [],
                (response.Errors ?? []).filter((_: string, errorIndex: number) => errorIndex === index)
            )
        );
    }

    /** @inheritdoc */
    async getTailSequenceNumber(eventSourceId?: string): Promise<EventSequenceNumber> {
        const response = await Grpc.call<GetTailSequenceNumberResponse>(callback =>
            this._connection.eventSequences.getTailSequenceNumber(
                {
                    EventStore: this._eventStoreName,
                    Namespace: this._namespace,
                    EventSequenceId: this.id.value,
                    EventSourceId: eventSourceId ?? '',
                    EventTypes: [],
                    EventSourceType: 'Default',
                    EventStreamId: '',
                    EventStreamType: 'Default'
                },
                callback
            )
        );

        return new EventSequenceNumber(response.SequenceNumber ?? 0);
    }

    /** @inheritdoc */
    async hasEventsFor(eventSourceId: string): Promise<boolean> {
        const response = await Grpc.call<HasEventsForEventSourceIdResponse>(callback =>
            this._connection.eventSequences.hasEventsForEventSourceId(
                {
                    EventStore: this._eventStoreName,
                    Namespace: this._namespace,
                    EventSequenceId: this.id.value,
                    EventSourceId: eventSourceId
                },
                callback
            )
        );

        return response.HasEvents ?? false;
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

        return {
            sequenceNumber: new EventSequenceNumber(sequenceNumber),
            constraintViolations: mappedViolations,
            errors: mappedErrors,
            isSuccess: mappedViolations.length === 0 && mappedErrors.length === 0
        };
    }
}
