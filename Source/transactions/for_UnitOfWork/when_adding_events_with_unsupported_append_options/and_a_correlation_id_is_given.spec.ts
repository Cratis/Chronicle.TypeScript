// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import type { AppendOptions } from '../../../eventSequences/AppendOptions.js';
import { EventSequenceId } from '../../../eventSequences/EventSequenceId.js';
import { AppendOptionNotSupportedInUnitOfWork } from '../../AppendOptionNotSupportedInUnitOfWork.js';
import { a_unit_of_work_with_a_recording_store, type RecordingUnitOfWork } from '../given/a_unit_of_work_with_a_recording_store.js';

chai.should();

describe('when adding events and a correlation identifier is given', () => {
    let recording: RecordingUnitOfWork;
    let error: unknown;
    let buffered: ReadonlyArray<object>;

    beforeEach(async () => {
        recording = a_unit_of_work_with_a_recording_store();
        const { unitOfWork } = recording;
        unitOfWork.addEvent(EventSequenceId.eventLog, 'a-1', { order: 0 });
        const options: AppendOptions = { correlationId: 'private-correlation-id', subject: 's', concurrencyScope: { sequenceNumber: 2n } };
        error = undefined;
        try {
            unitOfWork.addEvent(EventSequenceId.eventLog, 'a-1', { order: 1 }, options);
        } catch (caught) {
            error = caught;
        }
        buffered = unitOfWork.getEvents();
        await unitOfWork.commit();
    });

    it('should reject the unsupported option', () => error!.should.be.instanceOf(AppendOptionNotSupportedInUnitOfWork));
    it('should name the option', () => (error as AppendOptionNotSupportedInUnitOfWork).optionName.should.equal('correlationId'));
    it('should not disclose the value', () => (error as Error).message.should.not.contain('private-correlation-id'));
    it('should keep only the first event', () => buffered.should.deep.equal([{ order: 0 }]));
    it('should commit only the first event', () => recording.appends[0].events.should.deep.equal([{ eventSourceId: 'a-1', event: { order: 0 } }]));
    it('should not enroll the refused scope', () => recording.appends[0].options.should.not.have.property('concurrencyScopes'));
});
