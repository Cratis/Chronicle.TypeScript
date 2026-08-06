// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { describe, expect, it, vi } from 'vitest';
import { Guid } from '@cratis/fundamentals';
import type { AppendResult } from '../eventSequences/AppendResult';
import { EventSequenceId } from '../eventSequences/EventSequenceId';
import { EventSequenceNumber } from '../eventSequences/EventSequenceNumber';
import type { IEventSequence } from '../eventSequences/IEventSequence';
import type { IEventStore } from '../IEventStore';
import { UnitOfWork } from './UnitOfWork';

function createAppendResult(overrides: Partial<AppendResult> = {}): AppendResult {
    return {
        sequenceNumber: EventSequenceNumber.first,
        constraintViolations: [],
        errors: [],
        isSuccess: true,
        waitForCompletion: vi.fn(),
        ...overrides
    };
}

function createUnitOfWork(appendManyResult: AppendResult[]) {
    const appendMany = vi.fn().mockResolvedValue(appendManyResult);
    const eventSequence = { appendMany } as unknown as IEventSequence;
    const eventStore = { getEventSequence: vi.fn().mockReturnValue(eventSequence) } as unknown as IEventStore;
    const unitOfWork = new UnitOfWork(Guid.create(), vi.fn(), eventStore);
    return { unitOfWork, eventStore };
}

class SomethingHappened {
    constructor(readonly value: string = '') {}
}

describe('UnitOfWork', () => {
    describe('when filtering violations after a commit', () => {
        const constraintViolation = { constraintId: 'unique', message: 'Value must be unique', details: {} };
        const concurrencyViolation = {
            eventSourceId: 'some-event-source',
            expectedSequenceNumber: new EventSequenceNumber(1n),
            actualSequenceNumber: new EventSequenceNumber(2n)
        };
        const appendError = { message: 'Something went wrong' };

        const { unitOfWork } = createUnitOfWork([
            createAppendResult({ constraintViolations: [constraintViolation], isSuccess: false }),
            createAppendResult({ concurrencyViolation, isSuccess: false }),
            createAppendResult({ errors: [appendError], isSuccess: false }),
            createAppendResult()
        ]);

        it('should expose the constraint violations, concurrency violations, and errors as separate thin filters over getAppendResults', async () => {
            unitOfWork.addEvent(EventSequenceId.eventLog, 'some-event-source', new SomethingHappened('a'));
            unitOfWork.addEvent(EventSequenceId.eventLog, 'some-event-source', new SomethingHappened('b'));
            unitOfWork.addEvent(EventSequenceId.eventLog, 'some-event-source', new SomethingHappened('c'));
            unitOfWork.addEvent(EventSequenceId.eventLog, 'some-event-source', new SomethingHappened('d'));

            await unitOfWork.commit();

            expect(unitOfWork.getAppendResults()).toHaveLength(4);
            expect(unitOfWork.getConstraintViolations()).toEqual([constraintViolation]);
            expect(unitOfWork.getConcurrencyViolations()).toEqual([concurrencyViolation]);
            expect(unitOfWork.getAppendErrors()).toEqual([appendError]);
        });
    });

    describe('when nothing failed', () => {
        const { unitOfWork } = createUnitOfWork([createAppendResult(), createAppendResult()]);

        it('should return empty arrays for all three violation filters', async () => {
            unitOfWork.addEvent(EventSequenceId.eventLog, 'some-event-source', new SomethingHappened('a'));
            unitOfWork.addEvent(EventSequenceId.eventLog, 'some-event-source', new SomethingHappened('b'));

            await unitOfWork.commit();

            expect(unitOfWork.getConstraintViolations()).toEqual([]);
            expect(unitOfWork.getConcurrencyViolations()).toEqual([]);
            expect(unitOfWork.getAppendErrors()).toEqual([]);
        });
    });
});
