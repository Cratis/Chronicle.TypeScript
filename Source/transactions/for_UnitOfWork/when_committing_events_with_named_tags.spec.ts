// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { Guid } from '@cratis/fundamentals';
import { beforeEach, chai, describe, it, vi } from 'vitest';
import { InvalidNamedTag, NamedTag } from '../../events/index.js';
import { EventSequenceId, type EventForEventSourceId } from '../../eventSequences/index.js';
import type { IEventStore } from '../../IEventStore.js';
import { UnitOfWork } from '../UnitOfWork.js';

const should = chai.should();
const success = { isSuccess: true, constraintViolations: [], errors: [] };

function a_unit_of_work() {
    const appendMany = vi.fn().mockResolvedValue([success, success]);
    const unitOfWork = new UnitOfWork(Guid.create(), () => {}, { getEventSequence: () => ({ appendMany }) } as unknown as IEventStore);
    return { unitOfWork, appendMany };
}

describe('when committing events with named tags in a unit of work', () => {
    let batch: EventForEventSourceId[];
    beforeEach(async () => {
        const { unitOfWork, appendMany } = a_unit_of_work();
        unitOfWork.addEvent(EventSequenceId.eventLog, 'a-1', { first: 1 },
            { eventSource: 'Account', namedTags: [new NamedTag('batch', 'b-1'), new NamedTag('batch', 'b-1')] });
        unitOfWork.addEvent(EventSequenceId.eventLog, 'a-2', { second: 2 }, { namedTags: [] });
        await unitOfWork.commit();
        batch = appendMany.mock.calls[0][0];
    });
    it('should carry the distinct named tags on the event they were added with', () =>
        batch[0].namedTags!.map(tag => `${tag.name}=${tag.value}`).should.deep.equal(['batch=b-1']));
    it('should keep routing beside the named tags', () => batch[0].eventSource!.should.equal('Account'));
    it('should not add named tags to an event added with none', () => should.not.exist(batch[1].namedTags));
});

describe('when adding an event with an invalid named tag to a unit of work', () => {
    let error: unknown;
    let unitOfWork: UnitOfWork;
    beforeEach(() => {
        ({ unitOfWork } = a_unit_of_work());
        try {
            unitOfWork.addEvent(EventSequenceId.eventLog, 'a-1', {}, { namedTags: [{ name: ' ', value: 'x' } as NamedTag] });
        } catch (caught) {
            error = caught;
        }
    });
    it('should fail with an invalid named tag error', () => (error as Error).should.be.instanceOf(InvalidNamedTag));
    it('should not buffer the event', () => unitOfWork.getEvents().should.have.lengthOf(0));
});
