// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { EventSequenceId } from '../../../eventSequences/EventSequenceId.js';
import type { EventForEventSourceId } from '../../../eventSequences/EventForEventSourceId.js';
import { a_unit_of_work_with_a_recording_store } from '../given/a_unit_of_work_with_a_recording_store.js';

chai.should();

describe('when adding events and the append option names are used', () => {
    let batch: EventForEventSourceId[];

    beforeEach(async () => {
        const { unitOfWork, appends } = a_unit_of_work_with_a_recording_store();
        unitOfWork.addEvent(EventSequenceId.eventLog, 'a-1', {}, { streamType: 'Orders', streamId: 'order-1', sourceType: 'Customer' });
        await unitOfWork.commit();
        batch = appends[0].events;
    });

    it('should keep the stream type', () => batch[0].eventStreamType!.should.equal('Orders'));
    it('should keep the stream identifier', () => batch[0].eventStreamId!.should.equal('order-1'));
    it('should keep the source type', () => batch[0].eventSourceType!.should.equal('Customer'));
    it('should not leak alias keys', () => Object.keys(batch[0]).sort().should.deep.equal(['event', 'eventSourceId', 'eventSourceType', 'eventStreamId', 'eventStreamType']));
});
