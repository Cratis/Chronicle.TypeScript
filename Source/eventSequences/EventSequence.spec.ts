// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { describe, expect, it, vi } from 'vitest';
import type { ChronicleConnection } from '../connection/index.js';
import { causationManager, CausationType } from '../auditing/index.js';
import type { IUnitOfWorkManager } from '../transactions/IUnitOfWorkManager.js';
import { eventType } from '../events/eventTypeDecorator.js';
import { CompleteStreamError } from './CompleteStreamError.js';
import { EventSequence } from './EventSequence.js';
import { EventSequenceId } from './EventSequenceId.js';
import { EventSequenceNumber } from './EventSequenceNumber.js';

class SomethingHappened {
    constructor(readonly value: string = '') {}
}
eventType('a3f6a2f0-6f2f-4a3c-9d3f-6f2f4a3c9d3f')(SomethingHappened);

class SomethingElseHappened {
    constructor(readonly value: string = '') {}
}
eventType('b3f6a2f0-6f2f-4a3c-9d3f-6f2f4a3c9d3g')(SomethingElseHappened);

function createEventSequence(
    overrides: Record<string, ReturnType<typeof vi.fn>> = {},
    observerOverrides: Record<string, ReturnType<typeof vi.fn>> = {}
) {
    const eventSequences = {
        redact: vi.fn().mockResolvedValue({}),
        redactForEventSource: vi.fn().mockResolvedValue({}),
        forEventSourceIdAndEventTypes: vi.fn().mockResolvedValue({ Data: [] }),
        fromSequenceNumber: vi.fn().mockResolvedValue({ Data: [] }),
        tailSequenceNumber: vi.fn().mockResolvedValue({ Data: { SequenceNumber: EventSequenceNumber.unset.value } }),
        completeStream: vi.fn().mockResolvedValue({ Response: { IsSuccess: true, SequenceNumber: 3n, Error: 0 } }),
        appendManyForEventSources: vi.fn().mockImplementation(async request => ({
            Response: { SequenceNumbers: request.Events.map((_: unknown, index: number) => BigInt(index)), ConstraintViolations: [], Errors: [] }
        })),
        append: vi.fn().mockResolvedValue({ Response: { SequenceNumber: 0n, ConstraintViolations: [], Errors: [] } }),
        ...overrides
    };
    const observers = {
        waitForCompletion: vi.fn().mockResolvedValue({ IsSuccess: true, FailedPartitions: [] }),
        ...observerOverrides
    };
    const connection = { eventSequences, observers } as unknown as ChronicleConnection;
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
        forEventSourceIdAndEventTypes: eventSequences.forEventSourceIdAndEventTypes,
        fromSequenceNumber: eventSequences.fromSequenceNumber,
        tailSequenceNumber: eventSequences.tailSequenceNumber,
        completeStream: eventSequences.completeStream,
        appendManyForEventSources: eventSequences.appendManyForEventSources,
        append: eventSequences.append,
        waitForCompletion: observers.waitForCompletion
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
                'a3f6a2f0-6f2f-4a3c-9d3f-6f2f4a3c9d3f',
                'b3f6a2f0-6f2f-4a3c-9d3f-6f2f4a3c9d3g'
            ]);
        });
    });

    describe('when getting events for an event source and event types', () => {
        const { eventSequence, forEventSourceIdAndEventTypes } = createEventSequence({
            forEventSourceIdAndEventTypes: vi.fn().mockResolvedValue({ Data: [wireAppendedEvent()] })
        });

        it('should call the RPC with the resolved event type filter and map the response', async () => {
            const result = await eventSequence.getForEventSourceIdAndEventTypes('some-event-source', [SomethingHappened]);

            expect(forEventSourceIdAndEventTypes).toHaveBeenCalledTimes(1);
            const request = forEventSourceIdAndEventTypes.mock.calls[0][0];
            expect(request.EventSourceId).toEqual('some-event-source');
            expect(request.EventTypeIds).toEqual('a3f6a2f0-6f2f-4a3c-9d3f-6f2f4a3c9d3f');

            expect(result).toHaveLength(1);
            expect(result[0].context.sequenceNumber).toEqual(7n);
            expect(result[0].context.eventSourceId).toEqual('some-event-source');
            expect(result[0].context.causation).toEqual([{ type: 'SomeCausation', occurred: new Date('2024-01-15T12:30:00Z'), properties: { key: 'value' } }]);
            expect(result[0].eventType.id.value).toEqual('a3f6a2f0-6f2f-4a3c-9d3f-6f2f4a3c9d3f');
            expect(result[0].content).toEqual({ value: 'hello' });
        });
    });

    describe('when getting events from a sequence number', () => {
        const { eventSequence, fromSequenceNumber } = createEventSequence({
            fromSequenceNumber: vi.fn().mockResolvedValue({ Data: [wireAppendedEvent()] })
        });

        it('should call the RPC starting from the given sequence number and map the response', async () => {
            const result = await eventSequence.getFromSequenceNumber(new EventSequenceNumber(7n), 'some-event-source', [SomethingHappened]);

            expect(fromSequenceNumber).toHaveBeenCalledTimes(1);
            const request = fromSequenceNumber.mock.calls[0][0];
            expect(request.FromEventSequenceNumber).toEqual(7n);
            expect(request.EventSourceId).toEqual('some-event-source');
            expect(request.EventTypeIds).toEqual('a3f6a2f0-6f2f-4a3c-9d3f-6f2f4a3c9d3f');

            expect(result).toHaveLength(1);
            expect(result[0].content).toEqual({ value: 'hello' });
        });
    });

    describe('when getting the next sequence number and the sequence is empty', () => {
        const { eventSequence, tailSequenceNumber } = createEventSequence({
            tailSequenceNumber: vi.fn().mockResolvedValue({ Data: { SequenceNumber: EventSequenceNumber.unset.value } })
        });

        it('should return the first sequence number', async () => {
            const result = await eventSequence.getNextSequenceNumber();

            expect(tailSequenceNumber).toHaveBeenCalledTimes(1);
            expect(result.value).toEqual(EventSequenceNumber.first.value);
        });
    });

    describe('when getting the next sequence number and events already exist', () => {
        const { eventSequence } = createEventSequence({
            tailSequenceNumber: vi.fn().mockResolvedValue({ Data: { SequenceNumber: 41n } })
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

        const { eventSequence, tailSequenceNumber } = createEventSequence({
            tailSequenceNumber: vi.fn().mockResolvedValue({ Data: { SequenceNumber: 5n } })
        });

        it('should filter the tail sequence number lookup to the event types the observer handles', async () => {
            await eventSequence.getTailSequenceNumberForObserver(SomeReactor);

            expect(tailSequenceNumber).toHaveBeenCalledTimes(1);
            const request = tailSequenceNumber.mock.calls[0][0];
            expect(request.EventTypeIds).toContain('a3f6a2f0-6f2f-4a3c-9d3f-6f2f4a3c9d3f');
            expect(request.EventTypeIds).not.toContain('b3f6a2f0-6f2f-4a3c-9d3f-6f2f4a3c9d3g');
        });
    });

    describe('when completing a non-default stream successfully', () => {
        const { eventSequence, completeStream } = createEventSequence({
            completeStream: vi.fn().mockResolvedValue({ Response: { IsSuccess: true, SequenceNumber: 9n, Error: 0 } })
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
            completeStream: vi.fn().mockResolvedValue({ Response: { IsSuccess: false, SequenceNumber: 0n, Error: 1 } })
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
            completeStream: vi.fn().mockResolvedValue({ Response: { IsSuccess: false, SequenceNumber: 0n, Error: 0 } })
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
        const { eventSequence, appendManyForEventSources } = createEventSequence();

        it('should apply the same concurrency scope to every distinct event source id', async () => {
            await eventSequence.appendMany(
                [
                    { eventSourceId: 'source-1', event: new SomethingHappened('a') },
                    { eventSourceId: 'source-2', event: new SomethingHappened('b') }
                ],
                { concurrencyScope: { sequenceNumber: 5n } });

            expect(appendManyForEventSources).toHaveBeenCalledTimes(1);
            const request = appendManyForEventSources.mock.calls[0][0];
            const scopeFor = (eventSourceId: string) => request.ConcurrencyScopes.find((s: { EventSourceId: string }) => s.EventSourceId === eventSourceId).Scope;
            expect(scopeFor('source-1').SequenceNumber).toEqual(5n);
            expect(scopeFor('source-2').SequenceNumber).toEqual(5n);
        });
    });

    describe('when appending many events for distinct event sources with a per-event-source-id concurrency scope map', () => {
        const { eventSequence, appendManyForEventSources } = createEventSequence();

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

            expect(appendManyForEventSources).toHaveBeenCalledTimes(1);
            const request = appendManyForEventSources.mock.calls[0][0];
            const scopeFor = (eventSourceId: string) => request.ConcurrencyScopes.find((s: { EventSourceId: string }) => s.EventSourceId === eventSourceId).Scope;
            expect(scopeFor('source-1').SequenceNumber).toEqual(5n);
            expect(scopeFor('source-2').SequenceNumber).toEqual(9n);
        });
    });

    describe('when appending many events with a per-event-source-id map that only covers some sources', () => {
        const { eventSequence, appendManyForEventSources } = createEventSequence();

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

            expect(appendManyForEventSources).toHaveBeenCalledTimes(1);
            const request = appendManyForEventSources.mock.calls[0][0];
            const scopeFor = (eventSourceId: string) => request.ConcurrencyScopes.find((s: { EventSourceId: string }) => s.EventSourceId === eventSourceId).Scope;
            expect(scopeFor('source-1').SequenceNumber).toEqual(5n);
            expect(scopeFor('source-2').SequenceNumber).toEqual(1n);
        });
    });

    describe('when appending several batches in one command scope', () => {
        it('should not carry the previous append link into the next append', async () => {
            const { eventSequence, appendManyForEventSources } = createEventSequence();
            await causationManager.run(new CausationType('Command'), {}, async () => {
                const commandChain = causationManager.getCurrentChain().map(c => ({
                    Occurred: { Value: c.occurred.toISOString() }, Type: c.type.name, Properties: { ...c.properties }
                }));
                await eventSequence.appendMany([{ eventSourceId: 'target', event: new SomethingHappened() }]);
                await eventSequence.appendMany([{ eventSourceId: 'target', event: new SomethingHappened() }]);

                // The test runner may have an ambient causation link; neither batch may add one to the next.
                const [first, second] = appendManyForEventSources.mock.calls;
                const expectedChain = [...commandChain, expect.objectContaining({
                    Type: CausationType.appendManyEvents.name, Properties: { count: '1' }
                })];
                expect(first[0].Causation).toEqual(expectedChain);
                expect(second[0].Causation).toEqual(expectedChain);
            });
        });
    });

    describe('when a batch has an independent concurrency label', () => {
        it('should send both the event target and the independent scope', async () => {
            const { eventSequence, appendManyForEventSources } = createEventSequence();
            await eventSequence.appendMany([{ eventSourceId: 'target', event: new SomethingHappened() }], {
                concurrencyScope: { sequenceNumber: 7n },
                concurrencyScopes: { independent: { sequenceNumber: 3n, eventSourceId: true } }
            });

            const scopes = appendManyForEventSources.mock.calls[0][0].ConcurrencyScopes;
            expect(scopes).toEqual(expect.arrayContaining([
                expect.objectContaining({ EventSourceId: 'independent', Scope: expect.objectContaining({ SequenceNumber: 3n, EventSourceId: true }) }),
                expect.objectContaining({ EventSourceId: 'target', Scope: expect.objectContaining({ SequenceNumber: 7n }) })
            ]));
        });
    });

    describe('when a batch expects no matching event', () => {
        it('should send the dedicated flag and unavailable sequence number', async () => {
            const { eventSequence, appendManyForEventSources } = createEventSequence();
            await eventSequence.appendMany([{ eventSourceId: 'target', event: new SomethingHappened() }], {
                concurrencyScopes: { independent: { sequenceNumber: EventSequenceNumber.beforeFirst.value, eventSourceId: true } }
            });
            const scope = appendManyForEventSources.mock.calls[0][0].ConcurrencyScopes[0].Scope;
            expect(scope.ExpectsNoMatchingEvent).toBe(true);
            expect(scope.SequenceNumber).toBe(EventSequenceNumber.unset.value);
        });
    });

    describe('when a batch contains only concurrency scopes', () => {
        it('should reject locally because the kernel requires an event', async () => {
            const { eventSequence, appendManyForEventSources } = createEventSequence();
            await expect(eventSequence.appendMany([], { concurrencyScopes: { independent: { sequenceNumber: 1n } } }))
                .rejects.toThrow('Chronicle requires at least one event');
            expect(appendManyForEventSources).not.toHaveBeenCalled();
        });
    });

    describe('when an EventForEventSourceId specifies its own stream targeting', () => {
        const { eventSequence, appendManyForEventSources } = createEventSequence();

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

            expect(appendManyForEventSources).toHaveBeenCalledTimes(1);
            const request = appendManyForEventSources.mock.calls[0][0];
            const [event] = request.Events;
            expect(event.EventStreamType).toEqual('custom-stream-type');
            expect(event.EventStreamId).toEqual('custom-stream-id');
            expect(event.EventSourceType).toEqual('custom-source-type');
            expect(event.Subject).toEqual('custom-subject');
        });
    });

    describe('when an EventForEventSourceId does not specify stream targeting', () => {
        const { eventSequence, appendManyForEventSources } = createEventSequence();

        it('should default to the default stream type, the event source id as stream id, and the event source id as subject', async () => {
            await eventSequence.appendMany([
                { eventSourceId: 'source-1', event: new SomethingHappened('a') }
            ]);

            expect(appendManyForEventSources).toHaveBeenCalledTimes(1);
            const request = appendManyForEventSources.mock.calls[0][0];
            const [event] = request.Events;
            expect(event.EventStreamType).toBeUndefined();
            expect(event.EventStreamId).toBeUndefined();
            expect(event.EventSourceType).toBeUndefined();
            expect(event.Subject).toEqual('source-1');
        });
    });

    describe('when subscribing to appendOperations and appending a single event', () => {
        const { eventSequence } = createEventSequence({
            append: vi.fn().mockResolvedValue({ Response: { SequenceNumber: 42n, ConstraintViolations: [], Errors: [] } })
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
            appendManyForEventSources: vi.fn().mockResolvedValue({ Response: { SequenceNumbers: [10n, 11n], ConstraintViolations: [], Errors: [] } })
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
            append: vi.fn().mockResolvedValue({ Response: { SequenceNumber: 1n, ConstraintViolations: [], Errors: [] } })
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
            append: vi.fn().mockResolvedValue({ Response: { SequenceNumber: 1n, ConstraintViolations: [], Errors: [] } })
        });

        it('should still complete the append normally', async () => {
            const result = await eventSequence.append('some-event-source', new SomethingHappened('a'));

            expect(result.isSuccess).toBe(true);
            expect(eventSequence.appendOperations.hasSubscribers).toBe(false);
        });
    });

    describe('when waiting for completion after a successful append', () => {
        const { eventSequence, waitForCompletion } = createEventSequence(
            { append: vi.fn().mockResolvedValue({ Response: { SequenceNumber: 42n, ConstraintViolations: [], Errors: [] } }) },
            { waitForCompletion: vi.fn().mockResolvedValue({ IsSuccess: true, FailedPartitions: [] }) });

        it('should call the WaitForCompletion RPC with the appended tail sequence number', async () => {
            const appendResult = await eventSequence.append('some-event-source', new SomethingHappened('a'));
            const result = await appendResult.waitForCompletion();

            expect(waitForCompletion).toHaveBeenCalledTimes(1);
            const request = waitForCompletion.mock.calls[0][0];
            expect(request.EventStore).toEqual('my-event-store');
            expect(request.Namespace).toEqual('my-namespace');
            expect(request.EventSequenceId).toEqual(EventSequenceId.eventLog.value);
            expect(request.TailEventSequenceNumber).toEqual(42n);
            expect(result.isSuccess).toBe(true);
            expect(result.failedPartitions).toEqual([]);
        });

        it('should pass the timeout as an abort signal', async () => {
            const appendResult = await eventSequence.append('some-event-source', new SomethingHappened('a'));
            await appendResult.waitForCompletion(1234);

            const options = waitForCompletion.mock.calls[0][1];
            expect(options.signal).toBeInstanceOf(AbortSignal);
        });
    });

    describe('when a caller cancels a completion wait', () => {
        it('should abort the underlying RPC and reject with the caller reason', async () => {
            const waitForCompletion = vi.fn().mockImplementation((_request, { signal }: { signal: AbortSignal }) =>
                new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true })));
            const { eventSequence } = createEventSequence({}, { waitForCompletion });
            const appendResult = await eventSequence.append('some-event-source', new SomethingHappened('a'));
            const controller = new AbortController();
            const reason = new Error('caller canceled');
            const pending = appendResult.waitForCompletion({ timeoutMs: 1000, signal: controller.signal });
            const signal = waitForCompletion.mock.calls[0][1].signal as AbortSignal;

            controller.abort(reason);

            await expect(pending).rejects.toBe(reason);
            expect(signal.aborted).toBe(true);
            expect(signal.reason).toBe(reason);
        });

        it('should cancel the underlying RPC when the options timeout expires', async () => {
            const waitForCompletion = vi.fn().mockImplementation((_request, { signal }: { signal: AbortSignal }) =>
                new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true })));
            const { eventSequence } = createEventSequence({}, { waitForCompletion });
            const appendResult = await eventSequence.append('some-event-source', new SomethingHappened('a'));

            await expect(appendResult.waitForCompletion({ timeoutMs: 5 })).rejects.toMatchObject({ name: 'TimeoutError' });
            expect(waitForCompletion.mock.calls[0][1].signal.aborted).toBe(true);
        });
    });

    describe('when waiting for completion and observers report a failed partition', () => {
        const { eventSequence } = createEventSequence(
            { append: vi.fn().mockResolvedValue({ Response: { SequenceNumber: 42n, ConstraintViolations: [], Errors: [] } }) },
            {
                waitForCompletion: vi.fn().mockResolvedValue({
                    IsSuccess: false,
                    FailedPartitions: [{
                        Id: { lo: 1n, hi: 0n },
                        ObserverId: 'some-observer',
                        Partition: 'some-partition',
                        Attempts: []
                    }]
                })
            });

        it('should report failure with the failed partitions', async () => {
            const appendResult = await eventSequence.append('some-event-source', new SomethingHappened('a'));
            const result = await appendResult.waitForCompletion({ timeoutMs: 1234 });

            expect(result.isSuccess).toBe(false);
            expect(result.failedPartitions).toHaveLength(1);
            expect(result.failedPartitions[0].observerId).toEqual('some-observer');
            expect(result.failedPartitions[0].partition).toEqual('some-partition');
        });
    });

    describe('when waiting for completion after an append that itself failed', () => {
        const { eventSequence, waitForCompletion } = createEventSequence({
            append: vi.fn().mockResolvedValue({
                Response: {
                    SequenceNumber: 0n,
                    ConstraintViolations: [{ ConstraintId: 'unique', Message: 'Value must be unique', Details: {} }],
                    Errors: []
                }
            })
        });

        it('should not call the RPC and resolve immediately as successful', async () => {
            const appendResult = await eventSequence.append('some-event-source', new SomethingHappened('a'));
            const result = await appendResult.waitForCompletion();

            expect(waitForCompletion).not.toHaveBeenCalled();
            expect(result.isSuccess).toBe(true);
            expect(result.failedPartitions).toEqual([]);
        });
    });

    describe('when a single append fails with a concurrency violation', () => {
        const { eventSequence } = createEventSequence({
            append: vi.fn().mockResolvedValue({
                Response: {
                    SequenceNumber: 18446744073709551615n,
                    ConstraintViolations: [],
                    Errors: [],
                    ConcurrencyViolation: { EventSourceId: 'some-event-source', ExpectedSequenceNumber: 1n, ActualSequenceNumber: 2n }
                }
            })
        });

        it('should map the concurrency violation and report the append as unsuccessful', async () => {
            const result = await eventSequence.append('some-event-source', new SomethingHappened('a'));

            expect(result.isSuccess).toBe(false);
            expect(result.concurrencyViolation).toEqual({
                eventSourceId: 'some-event-source',
                expectedSequenceNumber: new EventSequenceNumber(1n),
                actualSequenceNumber: new EventSequenceNumber(2n)
            });
        });
    });

    describe('when appendMany is rejected without sequence numbers', () => {
        const { eventSequence, waitForCompletion } = createEventSequence({
            appendManyForEventSources: vi.fn().mockResolvedValue({
                Response: {
                    SequenceNumbers: [],
                    ConstraintViolations: [{ ConstraintId: 'unique', Message: 'Value must be unique', Details: { value: 'a' } }],
                    Errors: ['Batch rejected']
                }
            })
        });

        it('should carry every batch rejection detail on each input result', async () => {
            const results = await eventSequence.appendMany('some-event-source', [new SomethingHappened('a'), new SomethingHappened('b')]);

            expect(results).toHaveLength(2);
            for (const result of results) {
                expect(result.isSuccess).toBe(false);
                expect(result.sequenceNumber.value).toBe(0n);
                expect(result.constraintViolations).toEqual([{ constraintId: 'unique', message: 'Value must be unique', details: { value: 'a' } }]);
                expect(result.errors).toEqual([{ message: 'Batch rejected' }]);
                await result.waitForCompletion();
            }
            expect(waitForCompletion).not.toHaveBeenCalled();
        });
    });

    describe('when appendMany has no sequence numbers or rejection details', () => {
        const { eventSequence } = createEventSequence({
            appendManyForEventSources: vi.fn().mockResolvedValue({ Response: { SequenceNumbers: [], ConstraintViolations: [], Errors: [] } })
        });

        it('should not report an unknown outcome as success', async () => {
            await expect(eventSequence.appendMany('some-event-source', [new SomethingHappened('a')]))
                .rejects.toThrow('Append many events returned no sequence numbers or rejection details.');
        });
    });

    describe('when appendMany fails with a concurrency violation', () => {
        const { eventSequence } = createEventSequence({
            appendManyForEventSources: vi.fn().mockResolvedValue({
                Response: {
                    SequenceNumbers: [18446744073709551615n],
                    ConstraintViolations: [],
                    Errors: [],
                    ConcurrencyViolations: [{ EventSourceId: 'some-event-source', ExpectedSequenceNumber: 1n, ActualSequenceNumber: 2n }]
                }
            })
        });

        it('should map the first concurrency violation onto every per-event result', async () => {
            const results = await eventSequence.appendMany('some-event-source', [new SomethingHappened('a')]);

            expect(results).toHaveLength(1);
            expect(results[0].isSuccess).toBe(false);
            expect(results[0].concurrencyViolation).toEqual({
                eventSourceId: 'some-event-source',
                expectedSequenceNumber: new EventSequenceNumber(1n),
                actualSequenceNumber: new EventSequenceNumber(2n)
            });
        });
    });
});
