// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import type { AppendOptions } from '../../../eventSequences/AppendOptions.js';
import type { EventForEventSourceId } from '../../../eventSequences/EventForEventSourceId.js';
import { EventSequenceId } from '../../../eventSequences/EventSequenceId.js';
import { a_unit_of_work_with_a_recording_store } from '../given/a_unit_of_work_with_a_recording_store.js';

chai.should();

describe('when adding events and unsupported options are undefined', () => {
    let entry: EventForEventSourceId;

    beforeEach(async () => {
        const { unitOfWork, appends } = a_unit_of_work_with_a_recording_store();
        const options: AppendOptions = { correlationId: undefined, concurrencyScopes: undefined, eventSourceId: undefined, subject: 's' };
        unitOfWork.addEvent(EventSequenceId.eventLog, 'a-1', {}, options);
        await unitOfWork.commit();
        entry = appends[0].events[0];
    });

    it('should keep the subject', () => entry.subject!.should.equal('s'));
});
