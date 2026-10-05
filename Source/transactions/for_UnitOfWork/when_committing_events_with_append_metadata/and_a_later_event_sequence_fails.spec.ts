// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { EventSequenceId } from '../../../eventSequences/EventSequenceId.js';
import { a_unit_of_work_with_a_recording_store, successfulAppendResult, type RecordedAppend } from '../given/a_unit_of_work_with_a_recording_store.js';
import type { UnitOfWork } from '../../UnitOfWork.js';

chai.should();

describe('when committing events with append metadata and a later event sequence fails', () => {
    let unitOfWork: UnitOfWork;
    let appends: RecordedAppend[];
    let error: unknown;

    beforeEach(async () => {
        const recording = a_unit_of_work_with_a_recording_store(async eventSequenceId => {
            if (eventSequenceId === 'outbox') throw new Error('Kernel unavailable');
            return [successfulAppendResult(0n)];
        });
        ({ unitOfWork, appends } = recording);
        unitOfWork.addEvent(EventSequenceId.eventLog, 'a-1', { order: 0 }, { subject: 'first' });
        unitOfWork.addEvent(new EventSequenceId('outbox'), 'a-1', { order: 1 }, { subject: 'second' });
        error = await unitOfWork.commit().catch(caught => caught);
    });

    it('should reject the commit', () => (error as Error).message.should.equal('Kernel unavailable'));
    it('should have written the earlier event sequence, since appends to separate sequences are not atomic', () => appends[0].events[0].subject!.should.equal('first'));
    it('should not mark the unit of work completed', () => unitOfWork.isCompleted.should.be.false);
});
