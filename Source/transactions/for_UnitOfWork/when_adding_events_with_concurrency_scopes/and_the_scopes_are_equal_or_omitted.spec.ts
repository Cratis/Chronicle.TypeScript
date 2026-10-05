// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { EventSequenceId } from '../../../eventSequences/EventSequenceId.js';
import { a_unit_of_work_with_a_recording_store, type RecordedAppend } from '../given/a_unit_of_work_with_a_recording_store.js';

chai.should();

describe('when adding events with concurrency scopes and the scopes are equal or omitted', () => {
    let appends: RecordedAppend[];

    beforeEach(async () => {
        const recording = a_unit_of_work_with_a_recording_store();
        recording.unitOfWork.addEvent(EventSequenceId.eventLog, 'a-1', { order: 0 }, { concurrencyScope: { sequenceNumber: 3n, eventStreamType: 'Orders' } });
        recording.unitOfWork.addEvent(EventSequenceId.eventLog, 'a-1', { order: 1 });
        recording.unitOfWork.addEvent(EventSequenceId.eventLog, 'a-1', { order: 2 }, { concurrencyScope: { eventStreamType: 'Orders', sequenceNumber: 3n } });
        recording.unitOfWork.addEvent(EventSequenceId.eventLog, 'b-1', { order: 3 }, { concurrencyScope: { sequenceNumber: 9n } });
        await recording.unitOfWork.commit();
        appends = recording.appends;
    });

    it('should append every event', () => appends[0].events.should.have.lengthOf(4));
    it('should pass one scope per event source', () => appends[0].options.concurrencyScopes!.should.deep.equal({
        'a-1': { sequenceNumber: 3n, eventStreamType: 'Orders' },
        'b-1': { sequenceNumber: 9n }
    }));
    it('should keep the correlation of the unit of work', () => appends[0].options.should.have.property('correlationId'));
});
