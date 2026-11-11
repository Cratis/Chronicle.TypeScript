// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { field } from '@cratis/fundamentals';
import { chai, describe, it } from 'vitest';
import { eventType } from '../../events/eventTypeDecorator.js';
import type { AppendOptions } from '../../eventSequences/AppendOptions.js';
import { EventSequenceNumber } from '../../eventSequences/EventSequenceNumber.js';
import { InProcessEventSequence, observeUnsupportedOperations } from '../InProcessEventSequence.js';
import { UnsupportedEventSequenceOperation } from '../UnsupportedEventSequenceOperation.js';

chai.should();

@eventType('ValidationOrderRecorded')
class Recorded {
    @field(String) name = 'recorded';
}

const create = () => new InProcessEventSequence({ constraints: 'disabled' }, [Recorded]);

async function rejects(pending: Promise<unknown>, operation: string): Promise<void> {
    await pending.then(() => { throw new Error('Expected rejection'); }, error => {
        (error instanceof UnsupportedEventSequenceOperation).should.equal(true);
        (error as Error).message.should.include(operation);
    });
}

describe('when preserving validation and commit order', () => {
    it('should report an invalid event before an invalid source', async () => {
        const sequence = create();
        await rejects(sequence.append('invalid source', null as unknown as object), 'append.event');
        sequence.results.length.should.equal(0);
        sequence.appendedEvents.length.should.equal(0);
    });

    it('should latch failures immediately and retain the async append guard until settlement', async () => {
        const sequence = create();
        const observed: UnsupportedEventSequenceOperation[] = [];
        observeUnsupportedOperations(sequence, error => observed.push(error));
        const first = sequence.append('invalid source', new Recorded());
        observed.length.should.equal(1);
        const overlapping = sequence.append('A', new Recorded());
        observed.length.should.equal(2);
        await rejects(first, 'append.source');
        await rejects(overlapping, 'Overlapping calls do not have proven ordering.');
        (await sequence.append('A', new Recorded())).sequenceNumber.value.should.equal(0n);
    });

    it('should reject shared batch options before inspecting entries', async () => {
        const sequence = create();
        await rejects(sequence.appendMany([null as never], { subject: 42 } as unknown as AppendOptions), 'appendMany.subject');
        sequence.results.length.should.equal(0);
        (await sequence.getNextSequenceNumber()).value.should.equal(0n);
    });

    it('should reject malformed entry metadata before invoking the correlation hook', async () => {
        let calls = 0;
        const sequence = new InProcessEventSequence({ constraints: 'disabled', correlationId: () => { calls++; throw new Error('hook'); } }, [Recorded]);
        await rejects(sequence.appendMany([{ eventSourceId: 'A', event: new Recorded(), unexpected: true } as never]), 'appendMany.entry');
        calls.should.equal(0);
    });

    it('should release a failed batch guard and leave its sequence numbers unallocated', async () => {
        const sequence = create();
        await rejects(sequence.appendMany('A', [new Recorded(), Object.assign(new Recorded(), { name: null })]), 'appendMany.content');
        sequence.results.length.should.equal(0);
        sequence.appendedEvents.length.should.equal(0);
        (await sequence.appendMany('B', [new Recorded()]))[0].sequenceNumber.value.should.equal(0n);
    });

    it('should discard staged seeds and release setup ownership after a later invalid event', async () => {
        const sequence = create();
        await rejects(sequence.seed('A', [new Recorded(), Object.assign(new Recorded(), { name: null })]), 'append.content');
        sequence.results.length.should.equal(0);
        sequence.appendedEvents.length.should.equal(0);
        await sequence.seed('B', [new Recorded()]);
        (await sequence.append('C', new Recorded())).sequenceNumber.value.should.equal(1n);
        sequence.results.length.should.equal(1);
    });

    it('should preserve the kernel whitespace distinction in stored subjects', async () => {
        const sequence = create();
        await sequence.append('A', new Recorded(), { subject: '\u0085' });
        await sequence.appendMany('B', [new Recorded()], { subject: '\ufeff' });
        sequence.appendedEvents.map(event => event.context.subject).should.deep.equal(['A', '\ufeff']);
    });

    it('should validate read arguments before route and catalog filters', async () => {
        const sequence = create();
        await rejects(sequence.getTailSequenceNumber(' A ', 'bad route', undefined, undefined, [class Missing {}]), 'getTailSequenceNumber.source');
        await rejects(sequence.getForEventSourceIdAndEventTypes(' A ', [], 'bad route'), 'getForEventSourceIdAndEventTypes.filters');
        await rejects(sequence.getFromSequenceNumber(new EventSequenceNumber(-1n), ' A '), 'getFromSequenceNumber.sequenceNumber');
    });
});
