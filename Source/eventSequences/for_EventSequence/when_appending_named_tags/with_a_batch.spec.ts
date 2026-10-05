// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import type { AppendManyForEventSourcesWithNamedTagsRequest } from '@cratis/chronicle.contracts';
import { NamedTag } from '../../../events/index.js';
import { a_sequence, NamedTagRecorded } from './given.fixture.js';

chai.should();

describe('when appending a batch with per-event and shared named tags', () => {
    let calls: ReturnType<typeof a_sequence>;
    let request: AppendManyForEventSourcesWithNamedTagsRequest;
    beforeEach(async () => {
        calls = a_sequence();
        await calls.sequence.appendMany([
            { eventSourceId: 'from', event: new NamedTagRecorded(), namedTags: [new NamedTag('side', 'debit'), new NamedTag('transfer', 't-1')] },
            { eventSourceId: 'to', event: new NamedTagRecorded(), namedTags: [new NamedTag('side', 'credit')] },
            { eventSourceId: 'audit', event: new NamedTagRecorded() }
        ], { namedTags: [new NamedTag('transfer', 't-1')] });
        request = calls.appendManyForEventSourcesWithNamedTags.mock.calls[0][0];
    });
    it('should use the dedicated named-tag batch call', () => calls.appendManyForEventSources.mock.calls.should.have.lengthOf(0));
    it('should send each event its own tags before the shared tags without duplicates', () =>
        request.Events.map(event => event.NamedTags.map(tag => `${tag.Name}=${tag.Value}`)).should.deep.equal([
            ['side=debit', 'transfer=t-1'], ['side=credit', 'transfer=t-1'], ['transfer=t-1']
        ]));
});

describe('when appending many events for one source with shared named tags', () => {
    let request: AppendManyForEventSourcesWithNamedTagsRequest;
    beforeEach(async () => {
        const calls = a_sequence();
        await calls.sequence.appendMany('source', [new NamedTagRecorded(), new NamedTagRecorded()], { namedTags: [new NamedTag('import', 'i-1')] });
        request = calls.appendManyForEventSourcesWithNamedTags.mock.calls[0][0];
    });
    it('should give every event the shared named tags', () =>
        request.Events.map(event => event.NamedTags).should.deep.equal([[{ Name: 'import', Value: 'i-1' }], [{ Name: 'import', Value: 'i-1' }]]));
});

describe('when appending a batch without named tags', () => {
    let calls: ReturnType<typeof a_sequence>;
    beforeEach(async () => {
        calls = a_sequence();
        await calls.sequence.appendMany([{ eventSourceId: 'one', event: new NamedTagRecorded(), namedTags: [] }]);
    });
    it('should keep using the plain batch call', () => calls.appendManyForEventSources.mock.calls.should.have.lengthOf(1));
    it('should not use the named-tag batch call', () => calls.appendManyForEventSourcesWithNamedTags.mock.calls.should.have.lengthOf(0));
});
