// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { EventSequenceId } from '../../../eventSequences/EventSequenceId.js';
import { ConflictingAppendOptionNamesInUnitOfWork } from '../../ConflictingAppendOptionNamesInUnitOfWork.js';
import type { UnitOfWork } from '../../UnitOfWork.js';
import { a_unit_of_work_with_a_recording_store } from '../given/a_unit_of_work_with_a_recording_store.js';

chai.should();

for (const [appendOptionName, transactionalOptionName] of [
    ['streamType', 'eventStreamType'],
    ['streamId', 'eventStreamId'],
    ['sourceType', 'eventSourceType']
]) {
    describe(`when adding events and ${appendOptionName} and ${transactionalOptionName} have different values`, () => {
        let unitOfWork: UnitOfWork;
        let error: unknown;

        beforeEach(() => {
            ({ unitOfWork } = a_unit_of_work_with_a_recording_store());
            error = undefined;
            unitOfWork.addEvent(EventSequenceId.eventLog, 'a-1', { order: 0 });
            try {
                unitOfWork.addEvent(EventSequenceId.eventLog, 'a-1', { order: 1 }, {
                    [appendOptionName]: 'private-alias-value',
                    [transactionalOptionName]: 'private-transactional-value',
                    concurrencyScope: { sequenceNumber: 2n }
                });
            } catch (caught) {
                error = caught;
            }
        });

        it('should reject the conflicting event', () => error!.should.be.instanceOf(ConflictingAppendOptionNamesInUnitOfWork));
        it('should name the append option', () => (error as ConflictingAppendOptionNamesInUnitOfWork).appendOptionName.should.equal(appendOptionName));
        it('should name the transactional option', () => (error as ConflictingAppendOptionNamesInUnitOfWork).transactionalOptionName.should.equal(transactionalOptionName));
        it('should not disclose the alias value', () => (error as Error).message.should.not.contain('private-alias-value'));
        it('should not disclose the transactional value', () => (error as Error).message.should.not.contain('private-transactional-value'));
        it('should keep only the first event', () => unitOfWork.getEvents().should.deep.equal([{ order: 0 }]));
    });
}

describe('when adding an event after conflicting append option names were refused', () => {
    let error: unknown;

    beforeEach(() => {
        const { unitOfWork } = a_unit_of_work_with_a_recording_store();
        unitOfWork.addEvent(EventSequenceId.eventLog, 'a-1', { order: 0 });
        try {
            unitOfWork.addEvent(EventSequenceId.eventLog, 'a-1', { order: 1 }, {
                streamId: 'private-alias-value', eventStreamId: 'private-transactional-value', concurrencyScope: { sequenceNumber: 2n }
            });
        } catch { /* The conflicting event is refused. */ }
        error = undefined;
        try {
            unitOfWork.addEvent(EventSequenceId.eventLog, 'a-1', { order: 2 }, { concurrencyScope: { sequenceNumber: 3n } });
        } catch (caught) {
            error = caught;
        }
    });

    it('should not have enrolled the refused concurrency scope', () => chai.should().not.exist(error));
});
