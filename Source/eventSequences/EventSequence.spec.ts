// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { describe, expect, it, vi } from 'vitest';
import type { ChronicleConnection } from '../connection';
import type { IUnitOfWorkManager } from '../transactions/IUnitOfWorkManager';
import { eventType } from '../events/eventTypeDecorator';
import { CompleteStreamError } from './CompleteStreamError';
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

function createEventSequence(overrides: Record<string, ReturnType<typeof vi.fn>> = {}) {
    const eventSequences = {
        redact: vi.fn().mockResolvedValue({}),
        redactForEventSource: vi.fn().mockResolvedValue({}),
        getForEventSourceIdAndEventTypes: vi.fn().mockResolvedValue({ Events: [] }),
        getEventsFromEventSequenceNumber: vi.fn().mockResolvedValue({ Events: [] }),
        getTailSequenceNumber: vi.fn().mockResolvedValue({ SequenceNumber: EventSequenceNumber.unset.value }),
        completeStream: vi.fn().mockResolvedValue({ IsSuccess: true, SequenceNumber: 3n, Error: 0 }),
        appendMany: vi.fn().mockResolvedValue({ SequenceNumbers: [], ConstraintViolations: [], Errors: [] }),
        append: vi.fn().mockResolvedValue({ SequenceNumber: 0n, ConstraintViolations: [], Errors: [] }),
        ...overrides
    };
    const connection = { eventSequences } as unknown as ChronicleConnection;
    const unitOfWorkManager = {} as IUnitOfWorkManager;

    const eventSequence = new EventSequence(
        EventSequenceId.eventLog,
        'my-event-store',
        'my-namespace',
        connection,
        unitOfWorkManager);

    return {
        eventSequence,
        redact: eventSequences.redact,
        redactForEventSource: eventSequences.redactForEventSource,
        getForEventSourceIdAndEventTypes: eventSequences.getForEventSourceIdAndEventTypes,
        getEventsFromEventSequenceNumber: eventSequences.getEventsFromEventSequenceNumber,
        getTailSequenceNumber: eventSequences.getTailSequenceNumber,
        completeStream: eventSequences.completeStream,
        appendMany: eventSequences.appendMany,
        append: eventSequences.append
    };
}

/** Reads exactly one value from an async iterable, then stops iterating it. */
async function takeOne<T>(iterable: AsyncIterable<T>): Promise<T> {
    const iterator = iterable[Symbol.asyncIterator]();
    try {
        const { value } = await iterator.next();
        return value as T;
    } finally {
        await iterator.return?.();
    }
}

function wireAppendedEvent() {
    return {
        Context: {
            EventType: { Id: 'a3f6a2f0-6f2f-4a3c-9d3f-6f2f4a3c9d3f', Generation: 1, Tombstone: false },
            EventSourceType: 'Default',
            EventSourceId: 'some-event-source',
            SequenceNumber: 7n,
            EventStreamType: 'Default',
            EventStreamId: 'some-event-source',
            Occurred: { Value: '2024-01-15T12:30:00.0000000+00:00' },
            EventStore: 'my-event-store',
            Namespace: 'my-namespace',
            CorrelationId: undefined,
            Causation: [{ Occurred: { Value: '2024-01-15T12:30:00.0000000+00:00' }, Type: 'SomeCausation', Properties: { key: 'value' } }],
            CausedBy: undefined,
            ObservationState: 0,
            Tags: [],
            Hash: ''
        },
        Content: JSON.stringify({ value: 'hello' }),
        OriginalContent: JSON.stringify({ value: 'hello' }),
        Revisions: [],
        GenerationalContent: {}
    };
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

    describe('when getting events for an event source and event types', () => {
        const { eventSequence, getForEventSourceIdAndEventTypes } = createEventSequence({
            getForEventSourceIdAndEventTypes: vi.fn().mockResolvedValue({ Events: [wireAppendedEvent()] })
        });

        it('should call the RPC with the resolved event type filter and map the response', async () => {
            const result = await eventSequence.getForEventSourceIdAndEventTypes('some-event-source', [SomethingHappened]);

            expect(getForEventSourceIdAndEventTypes).toHaveBeenCalledTimes(1);
            const request = getForEventSourceIdAndEventTypes.mock.calls[0][0];
            expect(request.EventSourceId).toEqual('some-event-source');
            expect(request.EventTypes).toEqual([{ Id: 'a3f6a2f0-6f2f-4a3c-9d3f-6f2f4a3c9d3f', Generation: 1, Tombstone: false }]);

            expect(result).toHaveLength(1);
            expect(result[0].context.sequenceNumber).toEqual(7n);
            expect(result[0].context.eventSourceId).toEqual('some-event-source');
            expect(result[0].context.causation).toEqual([{ type: 'SomeCausation', properties: { key: 'value' } }]);
            expect(result[0].eventType.id.value).toEqual('a3f6a2f0-6f2f-4a3c-9d3f-6f2f4a3c9d3f');
            expect(result[0].content).toEqual({ value: 'hello' });
        });
    });

    describe('when getting events from a sequence number', () => {
        const { eventSequence, getEventsFromEventSequenceNumber } = createEventSequence({
            getEventsFromEventSequenceNumber: vi.fn().mockResolvedValue({ Events: [wireAppendedEvent()] })
        });

        it('should call the RPC starting from the given sequence number and map the response', async () => {
            const result = await eventSequence.getFromSequenceNumber(new EventSequenceNumber(7n), 'some-event-source', [SomethingHappened]);

            expect(getEventsFromEventSequenceNumber).toHaveBeenCalledTimes(1);
            const request = getEventsFromEventSequenceNumber.mock.calls[0][0];
            expect(request.FromEventSequenceNumber).toEqual(7n);
            expect(request.EventSourceId).toEqual('some-event-source');
            expect(request.EventTypes).toEqual([{ Id: 'a3f6a2f0-6f2f-4a3c-9d3f-6f2f4a3c9d3f', Generation: 1, Tombstone: false }]);

            expect(result).toHaveLength(1);
            expect(result[0].content).toEqual({ value: 'hello' });
        });
    });

    describe('when getting the next sequence number and the sequence is empty', () => {
        const { eventSequence, getTailSequenceNumber } = createEventSequence({
            getTailSequenceNumber: vi.fn().mockResolvedValue({ SequenceNumber: EventSequenceNumber.unset.value })
        });

        it('should return the first sequence number', async () => {
            const result = await eventSequence.getNextSequenceNumber();

            expect(getTailSequenceNumber).toHaveBeenCalledTimes(1);
            expect(result.value).toEqual(EventSequenceNumber.first.value);
        });
    });

    describe('when getting the next sequence number and events already exist', () => {
        const { eventSequence } = createEventSequence({
            getTailSequenceNumber: vi.fn().mockResolvedValue({ SequenceNumber: 41n })
        });

        it('should return one past the tail sequence number', async () => {
            const result = await eventSequence.getNextSequenceNumber();

            expect(result.value).toEqual(42n);
        });
    });

    describe('when getting the tail sequence number for an observer type', () => {
        class SomeReactor {
            async somethingHappened(): Promise<void> {}
        }

        const { eventSequence, getTailSequenceNumber } = createEventSequence({
            getTailSequenceNumber: vi.fn().mockResolvedValue({ SequenceNumber: 5n })
        });

        it('should filter the tail sequence number lookup to the event types the observer handles', async () => {
            await eventSequence.getTailSequenceNumberForObserver(SomeReactor);

            expect(getTailSequenceNumber).toHaveBeenCalledTimes(1);
            const request = getTailSequenceNumber.mock.calls[0][0];
            expect(request.EventTypes).toContainEqual({ Id: 'a3f6a2f0-6f2f-4a3c-9d3f-6f2f4a3c9d3f', Generation: 1, Tombstone: false });
            expect(request.EventTypes).not.toContainEqual({ Id: 'b3f6a2f0-6f2f-4a3c-9d3f-6f2f4a3c9d3g', Generation: 1, Tombstone: false });
        });
    });

    describe('when completing a non-default stream successfully', () => {
        const { eventSequence, completeStream } = createEventSequence({
            completeStream: vi.fn().mockResolvedValue({ IsSuccess: true, SequenceNumber: 9n, Error: 0 })
        });

        it('should call the RPC and return the tail sequence number', async () => {
            const result = await eventSequence.completeStream('my-stream-type', 'my-stream-id');

            expect(completeStream).toHaveBeenCalledTimes(1);
            const request = completeStream.mock.calls[0][0];
            expect(request.EventStreamType).toEqual('my-stream-type');
            expect(request.EventStreamId).toEqual('my-stream-id');

            expect(result.isSuccess).toBe(true);
            if (result.isSuccess) {
                expect(result.sequenceNumber.value).toEqual(9n);
            }
        });
    });

    describe('when completing the default stream', () => {
        const { eventSequence } = createEventSequence({
            completeStream: vi.fn().mockResolvedValue({ IsSuccess: false, SequenceNumber: 0n, Error: 1 })
        });

        it('should return the DefaultStreamCannotBeCompleted error', async () => {
            const result = await eventSequence.completeStream('Default', '');

            expect(result.isSuccess).toBe(false);
            if (!result.isSuccess) {
                expect(result.error).toEqual(CompleteStreamError.DefaultStreamCannotBeCompleted);
            }
        });
    });

    describe('when completing an already-completed stream', () => {
        const { eventSequence } = createEventSequence({
            completeStream: vi.fn().mockResolvedValue({ IsSuccess: false, SequenceNumber: 0n, Error: 0 })
        });

        it('should return the AlreadyCompleted error', async () => {
            const result = await eventSequence.completeStream('my-stream-type', 'my-stream-id');

            expect(result.isSuccess).toBe(false);
            if (!result.isSuccess) {
                expect(result.error).toEqual(CompleteStreamError.AlreadyCompleted);
            }
        });
    });

    describe('when appending many events for distinct event sources with a shared concurrency scope option', () => {
        const { eventSequence, appendMany } = createEventSequence();

        it('should apply the same concurrency scope to every distinct event source id', async () => {
            await eventSequence.appendMany(
                [
                    { eventSourceId: 'source-1', event: new SomethingHappened('a') },
                    { eventSourceId: 'source-2', event: new SomethingHappened('b') }
                ],
                { concurrencyScope: { sequenceNumber: 5n } });

            expect(appendMany).toHaveBeenCalledTimes(1);
            const request = appendMany.mock.calls[0][0];
            expect(request.ConcurrencyScopes['source-1'].SequenceNumber).toEqual(5n);
            expect(request.ConcurrencyScopes['source-2'].SequenceNumber).toEqual(5n);
        });
    });

    describe('when appending many events for distinct event sources with a per-event-source-id concurrency scope map', () => {
        const { eventSequence, appendMany } = createEventSequence();

        it('should apply the distinct concurrency scope for each event source id', async () => {
            await eventSequence.appendMany(
                [
                    { eventSourceId: 'source-1', event: new SomethingHappened('a') },
                    { eventSourceId: 'source-2', event: new SomethingHappened('b') }
                ],
                {
                    concurrencyScopes: {
                        'source-1': { sequenceNumber: 5n },
                        'source-2': { sequenceNumber: 9n }
                    }
                });

            expect(appendMany).toHaveBeenCalledTimes(1);
            const request = appendMany.mock.calls[0][0];
            expect(request.ConcurrencyScopes['source-1'].SequenceNumber).toEqual(5n);
            expect(request.ConcurrencyScopes['source-2'].SequenceNumber).toEqual(9n);
        });
    });

    describe('when appending many events with a per-event-source-id map that only covers some sources', () => {
        const { eventSequence, appendMany } = createEventSequence();

        it('should fall back to the shared concurrency scope for sources without a map entry', async () => {
            await eventSequence.appendMany(
                [
                    { eventSourceId: 'source-1', event: new SomethingHappened('a') },
                    { eventSourceId: 'source-2', event: new SomethingHappened('b') }
                ],
                {
                    concurrencyScope: { sequenceNumber: 1n },
                    concurrencyScopes: {
                        'source-1': { sequenceNumber: 5n }
                    }
                });

            expect(appendMany).toHaveBeenCalledTimes(1);
            const request = appendMany.mock.calls[0][0];
            expect(request.ConcurrencyScopes['source-1'].SequenceNumber).toEqual(5n);
            expect(request.ConcurrencyScopes['source-2'].SequenceNumber).toEqual(1n);
        });
    });

    describe('when an EventForEventSourceId specifies its own stream targeting', () => {
        const { eventSequence, appendMany } = createEventSequence();

        it('should use the wrapper\'s own event stream type, id, source type, and subject', async () => {
            await eventSequence.appendMany([
                {
                    eventSourceId: 'source-1',
                    event: new SomethingHappened('a'),
                    eventStreamType: 'custom-stream-type',
                    eventStreamId: 'custom-stream-id',
                    eventSourceType: 'custom-source-type',
                    subject: 'custom-subject'
                }
            ]);

            expect(appendMany).toHaveBeenCalledTimes(1);
            const request = appendMany.mock.calls[0][0];
            const [event] = request.Events;
            expect(event.EventStreamType).toEqual('custom-stream-type');
            expect(event.EventStreamId).toEqual('custom-stream-id');
            expect(event.EventSourceType).toEqual('custom-source-type');
            expect(event.Subject).toEqual('custom-subject');
        });
    });

    describe('when an EventForEventSourceId does not specify stream targeting', () => {
        const { eventSequence, appendMany } = createEventSequence();

        it('should default to the default stream type, the event source id as stream id, and the event source id as subject', async () => {
            await eventSequence.appendMany([
                { eventSourceId: 'source-1', event: new SomethingHappened('a') }
            ]);

            expect(appendMany).toHaveBeenCalledTimes(1);
            const request = appendMany.mock.calls[0][0];
            const [event] = request.Events;
            expect(event.EventStreamType).toEqual('Default');
            expect(event.EventStreamId).toEqual('source-1');
            expect(event.EventSourceType).toEqual('Default');
            expect(event.Subject).toEqual('source-1');
        });
    });

    describe('when subscribing to appendOperations and appending a single event', () => {
        const { eventSequence } = createEventSequence({
            append: vi.fn().mockResolvedValue({ SequenceNumber: 42n, ConstraintViolations: [], Errors: [] })
        });

        it('should publish the appended event and its result to the subscriber', async () => {
            const operations = takeOne(eventSequence.appendOperations);

            // Give the subscriber a chance to attach its iterator before the append fires,
            // since appendOperations is a hot stream with no replay buffer.
            await new Promise(resolve => setTimeout(resolve, 0));
            await eventSequence.append('some-event-source', new SomethingHappened('a'));

            const published = await operations;
            expect(published).toHaveLength(1);
            expect(published[0].event.context.sequenceNumber).toEqual(42n);
            expect(published[0].event.context.eventSourceId).toEqual('some-event-source');
            expect(published[0].result.sequenceNumber.value).toEqual(42n);
            expect(published[0].result.isSuccess).toBe(true);
        });
    });

    describe('when subscribing to appendOperations and appending many events', () => {
        const { eventSequence } = createEventSequence({
            appendMany: vi.fn().mockResolvedValue({ SequenceNumbers: [10n, 11n], ConstraintViolations: [], Errors: [] })
        });

        it('should publish the full batch to the subscriber', async () => {
            const operations = takeOne(eventSequence.appendOperations);

            await new Promise(resolve => setTimeout(resolve, 0));
            await eventSequence.appendMany([
                { eventSourceId: 'source-1', event: new SomethingHappened('a') },
                { eventSourceId: 'source-2', event: new SomethingElseHappened('b') }
            ]);

            const published = await operations;
            expect(published).toHaveLength(2);
            expect(published[0].event.context.eventSourceId).toEqual('source-1');
            expect(published[0].result.sequenceNumber.value).toEqual(10n);
            expect(published[1].event.context.eventSourceId).toEqual('source-2');
            expect(published[1].result.sequenceNumber.value).toEqual(11n);
        });
    });

    describe('when two subscribers are iterating appendOperations at the same time', () => {
        const { eventSequence } = createEventSequence({
            append: vi.fn().mockResolvedValue({ SequenceNumber: 1n, ConstraintViolations: [], Errors: [] })
        });

        it('should multicast the same append to every subscriber', async () => {
            const first = takeOne(eventSequence.appendOperations);
            const second = takeOne(eventSequence.appendOperations);

            await new Promise(resolve => setTimeout(resolve, 0));
            await eventSequence.append('some-event-source', new SomethingHappened('a'));

            const [firstResult, secondResult] = await Promise.all([first, second]);
            expect(firstResult[0].result.sequenceNumber.value).toEqual(1n);
            expect(secondResult[0].result.sequenceNumber.value).toEqual(1n);
        });
    });

    describe('when nobody is subscribed to appendOperations', () => {
        const { eventSequence } = createEventSequence({
            append: vi.fn().mockResolvedValue({ SequenceNumber: 1n, ConstraintViolations: [], Errors: [] })
        });

        it('should still complete the append normally', async () => {
            const result = await eventSequence.append('some-event-source', new SomethingHappened('a'));

            expect(result.isSuccess).toBe(true);
            expect(eventSequence.appendOperations.hasSubscribers).toBe(false);
        });
    });
});
