// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { EventSequenceId } from '../../../eventSequences/EventSequenceId.js';
import { EventType } from '../../../events/EventType.js';
import { a_unit_of_work_with_a_recording_store, type RecordedAppend } from '../given/a_unit_of_work_with_a_recording_store.js';

chai.should();

describe('when adding events with concurrency scopes and the event type filters are equivalent', () => {
    let appends: RecordedAppend[];

    beforeEach(async () => {
        const recording = a_unit_of_work_with_a_recording_store();
        const orderPlaced = EventType.parse('OrderPlaced+1');
        const orderShipped = EventType.parse('OrderShipped+2');
        const add = (eventSourceId: string, order: number, concurrencyScope: object) =>
            recording.unitOfWork.addEvent(EventSequenceId.eventLog, eventSourceId, { order }, { concurrencyScope });

        add('omitted', 0, { sequenceNumber: 1n });
        add('omitted', 1, { sequenceNumber: 1n, eventTypes: [] });
        add('duplicates', 2, { sequenceNumber: 1n, eventTypes: [orderPlaced] });
        add('duplicates', 3, { sequenceNumber: 1n, eventTypes: [orderPlaced, EventType.parse('OrderPlaced+1')] });
        add('order', 4, { sequenceNumber: 1n, eventTypes: [orderPlaced, orderShipped] });
        add('order', 5, { sequenceNumber: 1n, eventTypes: [orderShipped, orderPlaced] });
        await recording.unitOfWork.commit();
        appends = recording.appends;
    });

    it('should append every event', () => appends[0].events.should.have.lengthOf(6));
});
