// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { Tag } from '../../../events/Tag.js';
import { EventSequenceId } from '../../../eventSequences/EventSequenceId.js';
import type { EventForEventSourceId } from '../../../eventSequences/EventForEventSourceId.js';
import { a_unit_of_work_with_a_recording_store } from '../given/a_unit_of_work_with_a_recording_store.js';

const should = chai.should();

describe('when committing events with append metadata and options differ per event', () => {
    const occurred = new Date('2026-01-02T03:04:05.000Z');
    const first = { name: 'first' };
    const second = { name: 'second' };
    const third = { name: 'third' };
    let batch: EventForEventSourceId[];

    beforeEach(async () => {
        const { unitOfWork, appends } = a_unit_of_work_with_a_recording_store();
        const tags = ['priority'];
        const occurredInput = new Date(occurred.getTime());
        unitOfWork.addEvent(EventSequenceId.eventLog, 'a-1', first, {
            eventStreamType: 'Orders', eventStreamId: 'order-1', eventSourceType: 'Customer',
            subject: 'subject-1', occurred: occurredInput, tags
        });
        unitOfWork.addEvent(EventSequenceId.eventLog, 'b-1', second, { tags: [new Tag('audit')] });
        unitOfWork.addEvent(EventSequenceId.eventLog, 'a-1', third);
        tags.push('mutated-after-enrollment');
        occurredInput.setUTCFullYear(1999);
        await unitOfWork.commit();
        batch = appends[0].events;
    });

    it('should append the events in input order', () => batch.map(_ => _.event).should.deep.equal([first, second, third]));
    it('should keep the stream type of the first event', () => batch[0].eventStreamType!.should.equal('Orders'));
    it('should keep the stream id of the first event', () => batch[0].eventStreamId!.should.equal('order-1'));
    it('should keep the source type of the first event', () => batch[0].eventSourceType!.should.equal('Customer'));
    it('should keep the subject of the first event', () => batch[0].subject!.should.equal('subject-1'));
    it('should keep the occurrence time given at enrollment', () => batch[0].occurred!.toISOString().should.equal(occurred.toISOString()));
    it('should keep the tags given at enrollment', () => batch[0].tags!.should.deep.equal(['priority']));
    it('should keep the tags of the second event', () => batch[1].tags!.map(String).should.deep.equal(['audit']));
    it('should not give the third event any metadata', () => Object.keys(batch[2]).sort().should.deep.equal(['event', 'eventSourceId']));
    it('should not leak the subject of the first event to the second', () => should.not.exist(batch[1].subject));
});
