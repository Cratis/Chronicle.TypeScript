// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { describe, expect, it, vi } from 'vitest';
import type { ChronicleConnection } from '../connection/index.js';
import type { IUnitOfWorkManager } from '../transactions/IUnitOfWorkManager.js';
import { compensationFor } from '../events/compensationForDecorator.js';
import { eventType } from '../events/eventTypeDecorator.js';
import { EventSequence } from './EventSequence.js';
import { EventSequenceId } from './EventSequenceId.js';
import { EventSequenceNumber } from './EventSequenceNumber.js';

class EntryPostedForSequence {
    constructor(readonly amount: number = 0) {}
}
eventType('entry-posted-for-sequence')(EntryPostedForSequence);

class EntryReversedForSequence {
    constructor(readonly reason: string = '') {}
}
eventType('entry-reversed-for-sequence')(EntryReversedForSequence);
compensationFor(EntryPostedForSequence)(EntryReversedForSequence);

function createEventSequence(response: object = { SequenceNumber: 8n, ConstraintViolations: [], Errors: [] }) {
    const compensate = vi.fn().mockResolvedValue({ Response: response });
    const connection = { eventSequences: { compensate }, observers: {} } as unknown as ChronicleConnection;
    const eventSequence = new EventSequence(
        EventSequenceId.eventLog, 'my-event-store', 'my-namespace', connection, {} as IUnitOfWorkManager);
    return { eventSequence, compensate };
}

describe('EventSequence', () => {
    describe('when compensating an event', () => {
        const { eventSequence, compensate } = createEventSequence();
        const occurred = new Date('2024-01-15T12:30:00.000Z');

        it('should send the compensated sequence number, event type and content', async () => {
            const result = await eventSequence.compensate(
                new EventSequenceNumber(3n),
                new EntryReversedForSequence('Wrong account'),
                { tags: ['finance'], occurred });

            expect(compensate).toHaveBeenCalledTimes(1);
            const request = compensate.mock.calls[0][0];
            expect(request.EventStore).toEqual('my-event-store');
            expect(request.Namespace).toEqual('my-namespace');
            expect(request.EventSequenceId).toEqual(EventSequenceId.eventLog.value);
            expect(request.CompensationFor).toEqual(3n);
            expect(request.EventType.Id).toEqual('entry-reversed-for-sequence');
            expect(JSON.parse(request.Content)).toEqual({ reason: 'Wrong account' });
            expect(request.Tags).toEqual(['finance']);
            expect(request.Occurred).toEqual({ Value: occurred.toISOString() });
            expect(result.isSuccess).toBe(true);
            expect(result.sequenceNumber.value).toEqual(8n);
        });
    });

    describe('when the kernel rejects the compensation', () => {
        const { eventSequence } = createEventSequence({
            SequenceNumber: 0n,
            ConstraintViolations: [],
            Errors: ['CompensatedEventNotFound']
        });

        it('should report the error in the result', async () => {
            const result = await eventSequence.compensate(new EventSequenceNumber(99n), new EntryReversedForSequence('x'));

            expect(result.isSuccess).toBe(false);
            expect(result.errors.map(error => error.message)).toEqual(['CompensatedEventNotFound']);
        });
    });
});
