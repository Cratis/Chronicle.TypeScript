// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { AppendWithNamedTagsRequest } from '@cratis/chronicle.contracts';
import { NamedTag } from '../../../events/index.js';
import type { AppendedEventWithResult } from '../../AppendedEventWithResult.js';
import { a_sequence, NamedTagRecorded } from './given.fixture.js';

chai.should();

describe('when appending a single event with named tags', () => {
    let calls: ReturnType<typeof a_sequence>;
    let request: AppendWithNamedTagsRequest;
    let notification: AppendedEventWithResult;
    beforeEach(async () => {
        calls = a_sequence();
        const iterator = calls.sequence.appendOperations[Symbol.asyncIterator]();
        const next = iterator.next();
        await calls.sequence.append('source', new NamedTagRecorded(), {
            tags: ['checkout'],
            namedTags: [new NamedTag('session', 's-1'), new NamedTag('session', 's-1'), new NamedTag('channel', 'web')]
        });
        notification = (await next).value[0];
        await iterator.return?.();
        request = calls.appendWithNamedTags.mock.calls[0][0];
    });
    it('should use the dedicated named-tag call instead of the plain append', () => calls.append.mock.calls.should.have.lengthOf(0));
    it('should send the distinct named tags in order', () =>
        request.NamedTags.should.deep.equal([{ Name: 'session', Value: 's-1' }, { Name: 'channel', Value: 'web' }]));
    it('should keep the plain tags beside the named tags', () => request.Tags.should.deep.equal(['checkout']));
    it('should encode through the published contract', () =>
        AppendWithNamedTagsRequest.decode(AppendWithNamedTagsRequest.encode(AppendWithNamedTagsRequest.fromPartial(request)).finish())
            .NamedTags.should.have.lengthOf(2));
    it('should carry the named tags on the append notification context', () =>
        notification.event.context.namedTags!.map(tag => tag.name).should.deep.equal(['session', 'channel']));
});

describe('when appending a single event with an empty named tag list', () => {
    let calls: ReturnType<typeof a_sequence>;
    beforeEach(async () => {
        calls = a_sequence();
        await calls.sequence.append('source', new NamedTagRecorded(), { namedTags: [] });
    });
    it('should use the plain append call', () => calls.append.mock.calls.should.have.lengthOf(1));
    it('should not use the named-tag call', () => calls.appendWithNamedTags.mock.calls.should.have.lengthOf(0));
});
