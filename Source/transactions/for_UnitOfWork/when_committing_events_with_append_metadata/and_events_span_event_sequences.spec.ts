// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { EventSequenceId } from '../../../eventSequences/EventSequenceId.js';
import type { AppendResult } from '../../../eventSequences/AppendResult.js';
import { a_unit_of_work_with_a_recording_store, successfulAppendResult, type RecordedAppend } from '../given/a_unit_of_work_with_a_recording_store.js';

chai.should();

describe('when committing events with append metadata and events span event sequences', () => {
    const outbox = new EventSequenceId('outbox');
    const scope = { sequenceNumber: 4n, eventSourceId: true };
    let appends: RecordedAppend[];
    let results: ReadonlyArray<AppendResult>;

    beforeEach(async () => {
        const recording = a_unit_of_work_with_a_recording_store(async (eventSequenceId, events) =>
            events.map((_, index) => successfulAppendResult(BigInt(eventSequenceId === 'outbox' ? 100 + index : index))));
        recording.unitOfWork.addEvent(EventSequenceId.eventLog, 'a-1', { order: 0 }, { subject: 'log-subject', concurrencyScope: scope });
        recording.unitOfWork.addEvent(outbox, 'a-1', { order: 1 }, { subject: 'outbox-subject' });
        recording.unitOfWork.addEvent(EventSequenceId.eventLog, 'a-1', { order: 2 });
        await recording.unitOfWork.commit();
        appends = recording.appends;
        results = recording.unitOfWork.getAppendResults();
    });

    it('should append once per event sequence', () => appends.map(_ => _.eventSequenceId).should.deep.equal([EventSequenceId.eventLog.value, 'outbox']));
    it('should keep the subject in the event log append', () => appends[0].events[0].subject!.should.equal('log-subject'));
    it('should keep the subject in the outbox append', () => appends[1].events[0].subject!.should.equal('outbox-subject'));
    it('should pass the scope to the event log append', () => appends[0].options.concurrencyScopes!.should.deep.equal({ 'a-1': scope }));
    it('should not pass the scope to the outbox append', () => appends[1].options.should.not.have.property('concurrencyScopes'));
    it('should report results in input order', () => results.map(_ => _.sequenceNumber.value).should.deep.equal([0n, 100n, 1n]));
});
