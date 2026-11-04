// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { EventSequenceId } from '../../../eventSequences/EventSequenceId.js';
import type { EventForEventSourceId } from '../../../eventSequences/EventForEventSourceId.js';
import { a_unit_of_work_with_a_recording_store } from '../given/a_unit_of_work_with_a_recording_store.js';

chai.should();

describe('when adding events and both names have the same value', () => {
    let entry: EventForEventSourceId;

    beforeEach(async () => {
        const { unitOfWork, appends } = a_unit_of_work_with_a_recording_store();
        unitOfWork.addEvent(EventSequenceId.eventLog, 'a-1', {}, { streamId: 'order-1', eventStreamId: 'order-1' });
        await unitOfWork.commit();
        entry = appends[0].events[0];
    });

    it('should accept the stream identifier', () => entry.eventStreamId!.should.equal('order-1'));
});
