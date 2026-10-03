// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { Guid } from '@cratis/fundamentals';
import { beforeEach, chai, describe, it, vi } from 'vitest';
import { EventSequenceId } from '../../eventSequences/index.js';
import type { IEventStore } from '../../IEventStore.js';
import { UnitOfWork } from '../UnitOfWork.js';

const should = chai.should();

describe('when committing events with event source routing in a unit of work', () => {
    let batch: any[];
    beforeEach(async () => {
        const appendMany = vi.fn().mockResolvedValue([{ isSuccess: true, constraintViolations: [], errors: [] }, { isSuccess: true, constraintViolations: [], errors: [] }]);
        const store = { getEventSequence: () => ({ appendMany }) } as unknown as IEventStore;
        const unitOfWork = new UnitOfWork(Guid.create(), () => {}, store);
        unitOfWork.addEvent(EventSequenceId.eventLog, 'a-1', { first: 1 }, { eventSource: 'Account', eventStream: 'Transactions' });
        unitOfWork.addEvent(EventSequenceId.eventLog, 'c-1', { second: 2 }, { eventSource: 'Customer' });
        await unitOfWork.commit();
        batch = appendMany.mock.calls[0][0];
    });
    it('should keep the source and stream of the first event', () => {
        batch[0].eventSource.should.equal('Account');
        batch[0].eventStream.should.equal('Transactions');
    });
    it('should keep a different source on the second event without a stream', () => {
        batch[1].eventSource.should.equal('Customer');
        should.not.exist(batch[1].eventStream);
    });
});

describe('when adding an event to a unit of work without routing', () => {
    it('should not add routing keys to the buffered event', async () => {
        const appendMany = vi.fn().mockResolvedValue([{ isSuccess: true, constraintViolations: [], errors: [] }]);
        const unitOfWork = new UnitOfWork(Guid.create(), () => {}, { getEventSequence: () => ({ appendMany }) } as unknown as IEventStore);
        unitOfWork.addEvent(EventSequenceId.eventLog, 'a-1', {});
        await unitOfWork.commit();
        Object.keys(appendMany.mock.calls[0][0][0]).sort().should.deep.equal(['event', 'eventSourceId']);
    });
});
