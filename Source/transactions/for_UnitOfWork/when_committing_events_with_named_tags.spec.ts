// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { Guid } from '@cratis/fundamentals';
import { beforeEach, chai, describe, it, vi } from 'vitest';
import { InvalidNamedTag, NamedTag } from '../../events/index.js';
import { EventSequenceId, NamedTagsWithRegisteredEventSourceNotSupported, type EventForEventSourceId } from '../../eventSequences/index.js';
import { ConcurrencyDimensions, type IEventSources } from '../../eventSources/index.js';
import type { IEventStore } from '../../IEventStore.js';
import { UnitOfWork } from '../UnitOfWork.js';

const should = chai.should();
const success = { isSuccess: true, constraintViolations: [], errors: [] };

class Account {}
const eventSources = {
    getFor: () => ({ type: Account, name: 'Account', description: '', concurrency: ConcurrencyDimensions.none, streams: [] })
} as unknown as IEventSources;

function a_unit_of_work() {
    const appendMany = vi.fn().mockImplementation(async (events: EventForEventSourceId[]) => events.map(() => success));
    const completed = vi.fn();
    const getKernelVersion = vi.fn().mockResolvedValue('19.37.4');
    const unitOfWork = new UnitOfWork(Guid.create(), completed, { eventSources, eventLog: { getKernelVersion }, getEventSequence: () => ({ appendMany }) } as unknown as IEventStore);
    return { unitOfWork, appendMany, completed, getKernelVersion };
}

describe('when committing events with named tags in a unit of work', () => {
    let batch: EventForEventSourceId[];
    beforeEach(async () => {
        const { unitOfWork, appendMany } = a_unit_of_work();
        unitOfWork.addEvent(EventSequenceId.eventLog, 'a-1', { first: 1 },
            { namedTags: [new NamedTag('batch', 'b-1'), new NamedTag('batch', 'b-1')] });
        unitOfWork.addEvent(EventSequenceId.eventLog, 'a-2', { second: 2 }, { namedTags: [] });
        await unitOfWork.commit();
        batch = appendMany.mock.calls[0][0];
    });
    it('should carry the distinct named tags on the event they were added with', () =>
        batch[0].namedTags!.map(tag => `${tag.name}=${tag.value}`).should.deep.equal(['batch=b-1']));
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

for (const separateSequences of [false, true]) {
    describe(`when committing named tags and a registered source in ${separateSequences ? 'different event sequences' : 'one batch'}`, () => {
        let calls: ReturnType<typeof a_unit_of_work>;
        let appended: EventForEventSourceId[];
        beforeEach(async () => {
            calls = a_unit_of_work();
            calls.unitOfWork.addEvent(EventSequenceId.eventLog, 'plain', { first: 1 });
            const sequenceId = separateSequences ? new EventSequenceId('other') : EventSequenceId.eventLog;
            calls.unitOfWork.addEvent(sequenceId, 'tagged', { second: 2 }, { namedTags: [new NamedTag('batch', 'b-1')] });
            calls.unitOfWork.addEvent(sequenceId, 'registered', { third: 3 }, { eventSource: Account });
            await calls.unitOfWork.commit();
            appended = calls.appendMany.mock.calls.flatMap(call => call[0] as EventForEventSourceId[]);
        });
        it('should write every group', () => calls.appendMany.mock.calls.should.have.lengthOf(separateSequences ? 2 : 1));
        it('should append every event', () => appended.map(event => event.eventSourceId).should.deep.equal(['plain', 'tagged', 'registered']));
        it('should keep the named tags on the tagged event', () =>
            appended[1].namedTags!.map(tag => `${tag.name}=${tag.value}`).should.deep.equal(['batch=b-1']));
        it('should keep the registered source on the registered event', () => appended[2].eventSource!.should.equal(Account));
        it('should complete the unit of work', () => calls.unitOfWork.isCompleted.should.be.true);
        it('should invoke completion callbacks', () => calls.completed.mock.calls.should.have.lengthOf(1));
    });
}

describe('when committing a registered source and named tags on one event', () => {
    let calls: ReturnType<typeof a_unit_of_work>;
    beforeEach(async () => {
        calls = a_unit_of_work();
        calls.unitOfWork.addEvent(EventSequenceId.eventLog, 'registered', {}, { eventSource: 'Account', namedTags: [new NamedTag('batch', 'b-1')] });
        await calls.unitOfWork.commit();
    });
    it('should append the registered source', () => calls.appendMany.mock.calls[0][0][0].eventSource.should.equal('Account'));
    it('should append the named tags', () =>
        calls.appendMany.mock.calls[0][0][0].namedTags.map((tag: NamedTag) => `${tag.name}=${tag.value}`).should.deep.equal(['batch=b-1']));
    it('should complete the unit of work', () => calls.unitOfWork.isCompleted.should.be.true);
});

describe('when committing a registered source with an empty named tag array', () => {
    let calls: ReturnType<typeof a_unit_of_work>;
    beforeEach(async () => {
        calls = a_unit_of_work();
        calls.unitOfWork.addEvent(EventSequenceId.eventLog, 'registered', {}, { eventSource: 'Account', namedTags: [] });
        await calls.unitOfWork.commit();
    });
    it('should append the registered source', () => calls.appendMany.mock.calls[0][0][0].eventSource.should.equal('Account'));
    it('should complete the unit of work', () => calls.unitOfWork.isCompleted.should.be.true);
});

for (const version of ['19.37.4', '19.37.4-development', '19.38.0']) {
    describe(`when committing named tags and a registered source on kernel ${version}`, () => {
        let calls: ReturnType<typeof a_unit_of_work>;

        beforeEach(async () => {
            calls = a_unit_of_work();
            calls.getKernelVersion.mockResolvedValue(version);
            calls.unitOfWork.addEvent(EventSequenceId.eventLog, 'registered', {}, { eventSource: Account, namedTags: [new NamedTag('batch', 'b-1')] });
            await calls.unitOfWork.commit();
        });

        it('should send the batch', () => calls.appendMany.mock.calls.should.have.lengthOf(1));
        it('should preserve the registered source', () => calls.appendMany.mock.calls[0][0][0].eventSource.should.equal(Account));
        it('should complete', () => calls.completed.mock.calls.should.have.lengthOf(1));
    });
}

for (const version of ['19.37.3', '1.0.0', undefined, '', 'unknown']) {
    for (const separateSequences of [false, true]) {
        describe(`when committing named tags and a registered source in ${separateSequences ? 'different sequences' : 'one batch'} on kernel ${version ?? 'unknown'}`, () => {
            let calls: ReturnType<typeof a_unit_of_work>;
            let error: unknown;

            beforeEach(async () => {
                calls = a_unit_of_work();
                calls.getKernelVersion.mockResolvedValue(version);
                calls.unitOfWork.addEvent(EventSequenceId.eventLog, 'registered', {}, { eventSource: Account });
                const sequenceId = separateSequences ? new EventSequenceId('other') : EventSequenceId.eventLog;
                calls.unitOfWork.addEvent(sequenceId, 'tagged', {}, { namedTags: [new NamedTag('batch', 'b-1')] });
                try {
                    await calls.unitOfWork.commit();
                } catch (caught) {
                    error = caught;
                }
            });

            it('should throw the public operation-specific error', () => (error instanceof NamedTagsWithRegisteredEventSourceNotSupported).should.equal(true));
            it('should not write even the first group', () => calls.appendMany.mock.calls.should.have.lengthOf(0));
            it('should retain all pending events', () => calls.unitOfWork.getEvents().should.have.lengthOf(2));
            it('should not complete', () => calls.completed.mock.calls.should.have.lengthOf(0));
        });
    }

    describe(`when committing unaffected batches on kernel ${version ?? 'unknown'}`, () => {
        let tagged: ReturnType<typeof a_unit_of_work>;
        let registered: ReturnType<typeof a_unit_of_work>;

        beforeEach(async () => {
            tagged = a_unit_of_work();
            registered = a_unit_of_work();
            tagged.getKernelVersion.mockResolvedValue(version);
            registered.getKernelVersion.mockResolvedValue(version);
            tagged.unitOfWork.addEvent(EventSequenceId.eventLog, 'tagged', {}, { namedTags: [new NamedTag('batch', 'b-1')] });
            registered.unitOfWork.addEvent(EventSequenceId.eventLog, 'registered', {}, { eventSource: Account, namedTags: [] });
            await tagged.unitOfWork.commit();
            await registered.unitOfWork.commit();
        });

        it('should send named tags without registered sources', () => tagged.appendMany.mock.calls.should.have.lengthOf(1));
        it('should send registered sources without tags', () => registered.appendMany.mock.calls.should.have.lengthOf(1));
        it('should not need the kernel version for either', () => {
            tagged.getKernelVersion.mock.calls.should.have.lengthOf(0);
            registered.getKernelVersion.mock.calls.should.have.lengthOf(0);
        });
    });
}
