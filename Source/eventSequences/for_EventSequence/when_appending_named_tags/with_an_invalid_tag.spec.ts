// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { InvalidNamedTag, type NamedTag } from '../../../events/index.js';
import { a_sequence, NamedTagRecorded } from './given.fixture.js';

chai.should();
const blank = { name: '', value: 'x' } as NamedTag;

describe('when appending a single event with an invalid named tag', () => {
    let calls: ReturnType<typeof a_sequence>;
    let error: unknown;
    beforeEach(async () => {
        calls = a_sequence();
        error = await calls.sequence.append('source', new NamedTagRecorded(), { namedTags: [blank] }).catch(caught => caught);
    });
    it('should fail with an invalid named tag error', () => (error as Error).should.be.instanceOf(InvalidNamedTag));
    it('should not call the kernel', () =>
        (calls.append.mock.calls.length + calls.appendWithNamedTags.mock.calls.length).should.equal(0));
});

describe('when appending a batch where one entry has an invalid named tag', () => {
    let calls: ReturnType<typeof a_sequence>;
    let error: unknown;
    beforeEach(async () => {
        calls = a_sequence();
        error = await calls.sequence.appendMany([
            { eventSourceId: 'one', event: new NamedTagRecorded() },
            { eventSourceId: 'two', event: new NamedTagRecorded(), namedTags: [null as unknown as NamedTag] }
        ]).catch(caught => caught);
    });
    it('should fail with an invalid named tag error', () => (error as Error).should.be.instanceOf(InvalidNamedTag));
    it('should not append any of the events', () =>
        (calls.appendManyForEventSources.mock.calls.length + calls.appendManyForEventSourcesWithNamedTags.mock.calls.length).should.equal(0));
});
