// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { EventSequenceId } from '../../../eventSequences/EventSequenceId.js';
import { EventSequenceNumber } from '../../../eventSequences/EventSequenceNumber.js';
import { a_unit_of_work_with_a_recording_store, successfulAppendResult } from '../given/a_unit_of_work_with_a_recording_store.js';
import type { UnitOfWork } from '../../UnitOfWork.js';

chai.should();

describe('when committing events with append metadata and the append is rejected', () => {
    const violation = { eventSourceId: 'a-1', expectedSequenceNumber: new EventSequenceNumber(1n), actualSequenceNumber: new EventSequenceNumber(5n) };
    let unitOfWork: UnitOfWork;

    beforeEach(async () => {
        ({ unitOfWork } = a_unit_of_work_with_a_recording_store(async () => [
            { ...successfulAppendResult(0n), isSuccess: false, concurrencyViolation: violation }
        ]));
        unitOfWork.addEvent(EventSequenceId.eventLog, 'a-1', { order: 0 }, { concurrencyScope: { sequenceNumber: 1n } });
        await unitOfWork.commit();
    });

    it('should not report success', () => unitOfWork.isSuccess.should.be.false);
    it('should surface the concurrency violation', () => unitOfWork.getConcurrencyViolations().should.deep.equal([violation]));
});
