// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { chai, describe, it } from 'vitest';
import type { EventContext } from '../../../events/EventContext.js';
import { BatchOutcomeKind } from '../BatchOutcomeKind.js';
import { DeferralNotSupportedByKernel } from '../DeferralNotSupportedByKernel.js';
import { EventAndContext } from '../EventAndContext.js';
import { EventBatch } from '../EventBatch.js';
import { PartitionNotInBatch } from '../PartitionNotInBatch.js';

chai.should();

class Opened { constructor(readonly owner: string = '') {} }
class Closed {}

const contextFor = (eventSourceId: string, sequenceNumber: bigint) => ({ eventSourceId, sequenceNumber } as EventContext);
const events = [
    new EventAndContext({ owner: 'Jane' }, contextFor('a', 1n), Opened),
    new EventAndContext({}, contextFor('b', 2n), Opened),
    new EventAndContext({}, contextFor('a', 3n), Closed)
];

describe('when reporting outcomes from an event batch', () => {
    it('should list its partitions in the order their first event appears', () => new EventBatch(events).partitions.should.deep.equal(['a', 'b']));

    it('should narrow events by type', () => {
        const opened = new EventBatch(events).ofType(Opened);
        opened.length.should.equal(2);
        opened[0].event.owner.should.equal('Jane');
        events[2].is(Opened).should.be.false;
    });

    it('should fail a partition from its first event in the batch', () => {
        const batch = new EventBatch(events);
        const error = new Error('down');
        batch.fail('a', error);
        batch.outcomes.should.deep.equal([{ partition: 'a', at: 1n, kind: BatchOutcomeKind.Failed, error, retryAfterMilliseconds: 0 }]);
    });

    it('should fail the partition of an event from that event', () => {
        const batch = new EventBatch(events);
        batch.fail(contextFor('a', 3n));
        batch.outcomes[0].at.should.equal(3n);
        batch.outcomes[0].partition.should.equal('a');
    });

    it('should defer a partition with its delay', () => {
        const batch = new EventBatch(events);
        batch.defer(contextFor('b', 2n), 250);
        batch.outcomes.should.deep.equal([{ partition: 'b', at: 2n, kind: BatchOutcomeKind.Deferred, retryAfterMilliseconds: 250 }]);
    });

    it('should fail instead of deferring when the kernel cannot take deferrals', () => {
        const batch = new EventBatch(events, false);
        batch.defer('b', 250);
        batch.outcomes[0].kind.should.equal(BatchOutcomeKind.Failed);
        batch.outcomes[0].error!.should.be.instanceOf(DeferralNotSupportedByKernel);
    });

    it('should refuse a partition it holds no events for', () => {
        const batch = new EventBatch(events);
        (() => batch.fail('c')).should.throw(PartitionNotInBatch);
        (() => batch.defer(contextFor('c', 9n), 10)).should.throw(PartitionNotInBatch);
    });
});
