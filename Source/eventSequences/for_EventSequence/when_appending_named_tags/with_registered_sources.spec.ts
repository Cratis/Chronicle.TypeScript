// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { ConcurrencyDimensions } from '../../../eventSources/index.js';
import { NamedTag } from '../../../events/index.js';
import { NamedTagsWithRegisteredEventSourceNotSupported, type AppendOptions, type EventForEventSourceId } from '../../index.js';
import { Account, a_sequence, NamedTagRecorded, registered_sources } from './given.fixture.js';

chai.should();
const namedTags = [new NamedTag('batch', 'b-1')];
const entry = (options: Partial<EventForEventSourceId> = {}): EventForEventSourceId =>
    ({ eventSourceId: 'source', event: new NamedTagRecorded(), ...options });

const batches: Array<{ description: string; events: EventForEventSourceId[]; options?: AppendOptions }> = [
    { description: 'tags and a registered source on the same entry', events: [entry({ eventSource: Account, namedTags })] },
    { description: 'a tagged entry before an untagged registered entry', events: [entry({ namedTags }), entry({ eventSource: 'Account' })] },
    { description: 'an untagged registered entry before a tagged entry', events: [entry({ eventSource: 'Account' }), entry({ namedTags })] },
    { description: 'shared tags and a registered entry', events: [entry({ eventSource: 'Account' })], options: { namedTags } },
    { description: 'per-entry tags and a shared registered source', events: [entry({ namedTags })], options: { eventSource: Account } }
];

for (const batch of batches) {
    describe(`when appending a batch with ${batch.description}`, () => {
        let calls: ReturnType<typeof a_sequence>;
        let error: unknown;
        beforeEach(async () => {
            calls = a_sequence(registered_sources(ConcurrencyDimensions.eventSourceId));
            error = await calls.sequence.appendMany(batch.events, batch.options).catch(caught => caught);
        });
        it('should reject with the typed unsupported combination error', () =>
            (error as Error).should.be.instanceOf(NamedTagsWithRegisteredEventSourceNotSupported));
        it('should explain the kernel limitation', () => (error as Error).message.should.contain('drops registered event source routing'));
        it('should link to the kernel issue', () => (error as Error).message.should.contain('https://github.com/Cratis/Chronicle/issues/4603'));
        it('should not send a plain batch', () => calls.appendManyForEventSources.mock.calls.should.have.lengthOf(0));
        it('should not send a named-tag batch', () => calls.appendManyForEventSourcesWithNamedTags.mock.calls.should.have.lengthOf(0));
        it('should not read a tail to derive a guard', () => calls.tailSequenceNumber.mock.calls.should.have.lengthOf(0));
        it('should not fall back to single appends', () =>
            [...calls.append.mock.calls, ...calls.appendWithNamedTags.mock.calls].should.have.lengthOf(0));
    });
}

describe('when appending a same-source batch with shared named tags and registered routing', () => {
    let error: unknown;
    beforeEach(async () => {
        const calls = a_sequence(registered_sources());
        error = await calls.sequence.appendMany('source', [new NamedTagRecorded()], { eventSource: Account, namedTags }).catch(caught => caught);
    });
    it('should reject with the typed unsupported combination error', () =>
        (error as Error).should.be.instanceOf(NamedTagsWithRegisteredEventSourceNotSupported));
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
