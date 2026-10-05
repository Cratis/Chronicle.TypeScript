// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it, type Mock } from 'vitest';
import { EventSequenceId } from '../../eventSequences/EventSequenceId.js';
import { a_unit_of_work_with_a_recording_store } from './given/a_unit_of_work_with_a_recording_store.js';
import type { UnitOfWork } from '../UnitOfWork.js';

chai.should();

describe('when rolling back events with append metadata', () => {
    let unitOfWork: UnitOfWork;
    let record: Mock;

    beforeEach(async () => {
        ({ unitOfWork, record } = a_unit_of_work_with_a_recording_store());
        unitOfWork.addEvent(EventSequenceId.eventLog, 'a-1', { order: 0 }, { subject: 'subject-1', concurrencyScope: { sequenceNumber: 1n } });
        await unitOfWork.rollback();
    });

    it('should drop the buffered events', () => unitOfWork.getEvents().should.be.empty);
    it('should not append anything', () => record.mock.calls.should.be.empty);
    it('should reject a later commit', async () => (await unitOfWork.commit().catch(caught => caught)).should.be.instanceOf(Error));
});
