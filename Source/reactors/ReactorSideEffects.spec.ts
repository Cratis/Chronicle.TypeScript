// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { describe, expect, it, vi } from 'vitest';
import type { IEventLog } from '../eventSequences/IEventLog';
import { EventSequenceNumber } from '../eventSequences/EventSequenceNumber';
import { eventType } from '../events/eventTypeDecorator';
import { appendReactorSideEffects } from './ReactorSideEffects';

class SomethingHappened {
    constructor(readonly value: string = '') {}
}
eventType('c3f6a2f0-6f2f-4a3c-9d3f-6f2f4a3c9d3h')(SomethingHappened);

class SomethingElseHappened {
    constructor(readonly value: string = '') {}
}
eventType('d3f6a2f0-6f2f-4a3c-9d3f-6f2f4a3c9d3i')(SomethingElseHappened);

function createEventLog(appendManyResult?: unknown) {
    const appendMany = vi.fn().mockResolvedValue(appendManyResult ?? [
        { sequenceNumber: new EventSequenceNumber(1n), constraintViolations: [], errors: [], isSuccess: true }
    ]);
    const eventLog = { appendMany } as unknown as IEventLog;
    return { eventLog, appendMany };
}

const successResultFor = (count: number) =>
    Array.from({ length: count }, (_, index) => ({
        sequenceNumber: new EventSequenceNumber(BigInt(index + 1)),
        constraintViolations: [],
        errors: [],
        isSuccess: true
    }));

describe('appendReactorSideEffects', () => {
    describe('when the handler returns undefined', () => {
        const { eventLog, appendMany } = createEventLog();

        it('should not append anything', async () => {
            const result = await appendReactorSideEffects(eventLog, undefined, 'triggering-source', 'Default', 'triggering-source');

            expect(appendMany).not.toHaveBeenCalled();
            expect(result.isSuccess).toBe(true);
            expect(result.errors).toEqual([]);
        });
    });

    describe('when the handler returns a single bare event', () => {
        const { eventLog, appendMany } = createEventLog(successResultFor(1));

        it('should append it targeting the triggering event\'s event source, stream, and subject', async () => {
            const result = await appendReactorSideEffects(
                eventLog,
                new SomethingHappened('a'),
                'triggering-source',
                'custom-stream-type',
                'custom-stream-id');

            expect(appendMany).toHaveBeenCalledTimes(1);
            const [events] = appendMany.mock.calls[0];
            expect(events).toEqual([{
                eventSourceId: 'triggering-source',
                event: expect.any(SomethingHappened),
                eventStreamType: 'custom-stream-type',
                eventStreamId: 'custom-stream-id',
                subject: 'triggering-source'
            }]);
            expect(result.isSuccess).toBe(true);
        });
    });

    describe('when the handler returns an array of bare events', () => {
        const { eventLog, appendMany } = createEventLog(successResultFor(2));

        it('should append all of them in a single atomic AppendMany call', async () => {
            await appendReactorSideEffects(
                eventLog,
                [new SomethingHappened('a'), new SomethingElseHappened('b')],
                'triggering-source',
                'Default',
                'triggering-source');

            expect(appendMany).toHaveBeenCalledTimes(1);
            const [events] = appendMany.mock.calls[0];
            expect(events).toHaveLength(2);
            expect(events[0].event).toBeInstanceOf(SomethingHappened);
            expect(events[1].event).toBeInstanceOf(SomethingElseHappened);
        });
    });

    describe('when the handler returns a single EventForEventSourceId', () => {
        const { eventLog, appendMany } = createEventLog(successResultFor(1));

        it('should append it using its own target rather than the triggering event\'s', async () => {
            const wrapper = {
                eventSourceId: 'other-source',
                event: new SomethingHappened('a'),
                eventStreamType: 'other-stream-type',
                eventStreamId: 'other-stream-id',
                subject: 'other-subject'
            };

            await appendReactorSideEffects(eventLog, wrapper, 'triggering-source', 'Default', 'triggering-source');

            expect(appendMany).toHaveBeenCalledTimes(1);
            const [events] = appendMany.mock.calls[0];
            expect(events).toEqual([wrapper]);
        });
    });

    describe('when the handler returns an array of EventForEventSourceId', () => {
        const { eventLog, appendMany } = createEventLog(successResultFor(2));

        it('should append all of them, each keeping its own target, in one atomic call', async () => {
            const wrappers = [
                { eventSourceId: 'source-1', event: new SomethingHappened('a') },
                { eventSourceId: 'source-2', event: new SomethingElseHappened('b') }
            ];

            await appendReactorSideEffects(eventLog, wrappers, 'triggering-source', 'Default', 'triggering-source');

            expect(appendMany).toHaveBeenCalledTimes(1);
            const [events] = appendMany.mock.calls[0];
            expect(events).toEqual(wrappers);
        });
    });

    describe('when the handler returns a mix of bare events and EventForEventSourceId', () => {
        const { eventLog, appendMany } = createEventLog(successResultFor(2));

        it('should append the bare event using the triggering context and the wrapper using its own, in one atomic call', async () => {
            const wrapper = { eventSourceId: 'other-source', event: new SomethingElseHappened('b') };
            const bareEvent = new SomethingHappened('a');

            await appendReactorSideEffects(eventLog, [bareEvent, wrapper], 'triggering-source', 'Default', 'triggering-source');

            expect(appendMany).toHaveBeenCalledTimes(1);
            const [events] = appendMany.mock.calls[0];
            expect(events).toEqual([
                {
                    eventSourceId: 'triggering-source',
                    event: bareEvent,
                    eventStreamType: 'Default',
                    eventStreamId: 'triggering-source',
                    subject: 'triggering-source'
                },
                wrapper
            ]);
        });
    });

    describe('when a side-effect event fails to append', () => {
        const { eventLog, appendMany } = createEventLog([
            {
                sequenceNumber: EventSequenceNumber.unset,
                constraintViolations: [{ constraintId: 'unique', message: 'Value must be unique', details: {} }],
                errors: [],
                isSuccess: false
            }
        ]);

        it('should report failure with the constraint violation message', async () => {
            const result = await appendReactorSideEffects(eventLog, new SomethingHappened('a'), 'triggering-source', 'Default', 'triggering-source');

            expect(appendMany).toHaveBeenCalledTimes(1);
            expect(result.isSuccess).toBe(false);
            expect(result.errors).toEqual(['Value must be unique']);
        });
    });

    describe('when the handler returns a plain object that is not a known event type or EventForEventSourceId', () => {
        const { eventLog, appendMany } = createEventLog();

        it('should ignore it and not append anything', async () => {
            const result = await appendReactorSideEffects(eventLog, { some: 'value' }, 'triggering-source', 'Default', 'triggering-source');

            expect(appendMany).not.toHaveBeenCalled();
            expect(result.isSuccess).toBe(true);
        });
    });
});
