// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { ConcurrencyDimensions } from '../../../eventSources/index.js';
import { NamedTag } from '../../../events/index.js';
import type { AppendOptions, EventForEventSourceId } from '../../index.js';
import { Account, a_sequence, NamedTagRecorded, registered_sources } from './given.fixture.js';

chai.should();
const namedTags = [new NamedTag('batch', 'b-1')];
const tagged = [{ Name: 'batch', Value: 'b-1' }];
const entry = (options: Partial<EventForEventSourceId> = {}): EventForEventSourceId =>
    ({ eventSourceId: 'source', event: new NamedTagRecorded(), ...options });

type WireEvent = { EventSource: string; EventSourceType: string; NamedTags: Array<{ Name: string; Value: string }> };
type Batch = { description: string; events: EventForEventSourceId[]; options?: AppendOptions; registered: boolean[]; tags: Array<typeof tagged> };

const batches: Batch[] = [
    { description: 'tags and a registered source on the same entry', events: [entry({ eventSource: Account, namedTags })], registered: [true], tags: [tagged] },
    { description: 'a tagged entry before an untagged registered entry', events: [entry({ namedTags }), entry({ eventSource: 'Account' })], registered: [false, true], tags: [tagged, []] },
    { description: 'an untagged registered entry before a tagged entry', events: [entry({ eventSource: 'Account' }), entry({ namedTags })], registered: [true, false], tags: [[], tagged] },
    { description: 'shared tags and a registered entry', events: [entry({ eventSource: 'Account' })], options: { namedTags }, registered: [true], tags: [tagged] },
    { description: 'per-entry tags and a shared registered source', events: [entry({ namedTags })], options: { eventSource: Account }, registered: [true], tags: [tagged] }
];

for (const batch of batches) {
    describe(`when appending a batch with ${batch.description}`, () => {
        let calls: ReturnType<typeof a_sequence>;
        let wireEvents: WireEvent[];
        beforeEach(async () => {
            calls = a_sequence(registered_sources(ConcurrencyDimensions.eventSourceId));
            await calls.sequence.appendMany(batch.events, batch.options);
            wireEvents = calls.appendManyForEventSourcesWithNamedTags.mock.calls[0][0].Events;
        });
        it('should send one named-tag batch', () => calls.appendManyForEventSourcesWithNamedTags.mock.calls.should.have.lengthOf(1));
        it('should not send a plain batch', () => calls.appendManyForEventSources.mock.calls.should.have.lengthOf(0));
        it('should keep the registered event source on every registered event', () =>
            wireEvents.map(wireEvent => wireEvent.EventSource === 'Account').should.deep.equal(batch.registered));
        it('should keep the registered event source type on every registered event', () =>
            wireEvents.filter((_, index) => batch.registered[index]).every(wireEvent => wireEvent.EventSourceType === 'Account').should.be.true);
        it('should carry the named tags of each event', () => wireEvents.map(wireEvent => wireEvent.NamedTags).should.deep.equal(batch.tags));
    });
}

describe('when appending a same-source batch with shared named tags and registered routing', () => {
    let calls: ReturnType<typeof a_sequence>;
    let wireEvents: WireEvent[];
    beforeEach(async () => {
        calls = a_sequence(registered_sources());
        await calls.sequence.appendMany('source', [new NamedTagRecorded(), new NamedTagRecorded()], { eventSource: Account, namedTags });
        wireEvents = calls.appendManyForEventSourcesWithNamedTags.mock.calls[0][0].Events;
    });
    it('should keep the registered event source on every event', () =>
        wireEvents.map(wireEvent => wireEvent.EventSource).should.deep.equal(['Account', 'Account']));
    it('should carry the shared named tags on every event', () => wireEvents.map(wireEvent => wireEvent.NamedTags).should.deep.equal([tagged, tagged]));
});

describe('when appending a registered-source batch with empty named tags', () => {
    let calls: ReturnType<typeof a_sequence>;
    beforeEach(async () => {
        calls = a_sequence(registered_sources());
        await calls.sequence.appendMany([entry({ eventSource: Account, namedTags: [] })], { namedTags: [] });
    });
    it('should retain registered routing on the plain batch call', () =>
        calls.appendManyForEventSources.mock.calls[0][0].Events[0].EventSource.should.equal('Account'));
    it('should not send a named-tag batch', () => calls.appendManyForEventSourcesWithNamedTags.mock.calls.should.have.lengthOf(0));
});

describe('when appending a single event with named tags and a registered source', () => {
    let calls: ReturnType<typeof a_sequence>;
    beforeEach(async () => {
        calls = a_sequence(registered_sources());
        await calls.sequence.append('source', new NamedTagRecorded(), { eventSource: Account, namedTags });
    });
    it('should retain registered routing on the dedicated single append call', () =>
        calls.appendWithNamedTags.mock.calls[0][0].EventSource.should.equal('Account'));
    it('should retain the named tags on the single append', () =>
        calls.appendWithNamedTags.mock.calls[0][0].NamedTags.should.deep.equal([{ Name: 'batch', Value: 'b-1' }]));
});
