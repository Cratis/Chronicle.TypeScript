// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { describe, expect, it, vi } from 'vitest';
import type { ChronicleConnection } from '../connection';
import type { IUnitOfWorkManager } from '../transactions/IUnitOfWorkManager';
import { eventType } from '../events/eventTypeDecorator';
import { EventSequence } from './EventSequence';
import { EventSequenceId } from './EventSequenceId';
import { EventSequenceNumber } from './EventSequenceNumber';

class SomethingHappened {
    constructor(readonly value: string = '') {}
}
eventType('a3f6a2f0-6f2f-4a3c-9d3f-6f2f4a3c9d3f')(SomethingHappened);

class SomethingElseHappened {
    constructor(readonly value: string = '') {}
}
eventType('b3f6a2f0-6f2f-4a3c-9d3f-6f2f4a3c9d3g')(SomethingElseHappened);

function createEventSequence() {
    const redact = vi.fn().mockResolvedValue({});
    const redactForEventSource = vi.fn().mockResolvedValue({});
    const connection = {
        eventSequences: { redact, redactForEventSource }
    } as unknown as ChronicleConnection;
    const unitOfWorkManager = {} as IUnitOfWorkManager;

    const eventSequence = new EventSequence(
        EventSequenceId.eventLog,
        'my-event-store',
        'my-namespace',
        connection,
        unitOfWorkManager);

    return { eventSequence, redact, redactForEventSource };
}

describe('EventSequence', () => {
    describe('when redacting a single event', () => {
        const { eventSequence, redact } = createEventSequence();
        const sequenceNumber = new EventSequenceNumber(42n);

        it('should call the Redact RPC with the correct payload', async () => {
            await eventSequence.redact(sequenceNumber, 'GDPR erasure request');

            expect(redact).toHaveBeenCalledTimes(1);
            const request = redact.mock.calls[0][0];
            expect(request.EventStore).toEqual('my-event-store');
            expect(request.Namespace).toEqual('my-namespace');
            expect(request.EventSequenceId).toEqual(EventSequenceId.eventLog.value);
            expect(request.SequenceNumber).toEqual(42n);
            expect(request.Reason).toEqual('GDPR erasure request');
        });
    });

    describe('when redacting all events for an event source without event type filters', () => {
        const { eventSequence, redactForEventSource } = createEventSequence();

        it('should call the RedactForEventSource RPC with an empty event type filter', async () => {
            await eventSequence.redactForEventSource('some-event-source', 'GDPR erasure request');

            expect(redactForEventSource).toHaveBeenCalledTimes(1);
            const request = redactForEventSource.mock.calls[0][0];
            expect(request.EventStore).toEqual('my-event-store');
            expect(request.Namespace).toEqual('my-namespace');
            expect(request.EventSequenceId).toEqual(EventSequenceId.eventLog.value);
            expect(request.EventSourceId).toEqual('some-event-source');
            expect(request.Reason).toEqual('GDPR erasure request');
            expect(request.EventTypes).toEqual([]);
        });
    });

    describe('when redacting all events for an event source filtered to specific event types', () => {
        const { eventSequence, redactForEventSource } = createEventSequence();

        it('should call the RedactForEventSource RPC with the resolved event type filter', async () => {
            await eventSequence.redactForEventSource('some-event-source', 'GDPR erasure request', [SomethingHappened, SomethingElseHappened]);

            expect(redactForEventSource).toHaveBeenCalledTimes(1);
            const request = redactForEventSource.mock.calls[0][0];
            expect(request.EventTypes).toEqual([
                { Id: 'a3f6a2f0-6f2f-4a3c-9d3f-6f2f4a3c9d3f', Generation: 1, Tombstone: false },
                { Id: 'b3f6a2f0-6f2f-4a3c-9d3f-6f2f4a3c9d3g', Generation: 1, Tombstone: false }
            ]);
        });
    });
});
