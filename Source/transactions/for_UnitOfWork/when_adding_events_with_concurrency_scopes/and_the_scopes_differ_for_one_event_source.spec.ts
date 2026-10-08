// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { EventSequenceId } from '../../../eventSequences/EventSequenceId.js';
import { ConflictingConcurrencyScopesInUnitOfWork } from '../../ConflictingConcurrencyScopesInUnitOfWork.js';
import { a_unit_of_work_with_a_recording_store } from '../given/a_unit_of_work_with_a_recording_store.js';
import type { UnitOfWork } from '../../UnitOfWork.js';

chai.should();

describe('when adding events with concurrency scopes and the scopes differ for one event source', () => {
    let unitOfWork: UnitOfWork;
    let error: unknown;

    beforeEach(() => {
        ({ unitOfWork } = a_unit_of_work_with_a_recording_store());
        unitOfWork.addEvent(EventSequenceId.eventLog, 'a-1', { order: 0 }, { concurrencyScope: { sequenceNumber: 1n } });
        try {
            unitOfWork.addEvent(EventSequenceId.eventLog, 'a-1', { order: 1 }, { concurrencyScope: { sequenceNumber: 2n } });
        } catch (caught) {
            error = caught;
        }
    });

    it('should reject the conflicting event', () => error!.should.be.instanceOf(ConflictingConcurrencyScopesInUnitOfWork));
    it('should not name the event source in the message', () => (error as Error).message.should.not.contain('a-1'));
    it('should keep only the first event', () => unitOfWork.getEvents().should.deep.equal([{ order: 0 }]));
});
