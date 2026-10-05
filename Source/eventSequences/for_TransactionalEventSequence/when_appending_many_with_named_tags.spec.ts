// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it, vi } from 'vitest';
import { InvalidNamedTag, NamedTag } from '../../events/index.js';
import type { IUnitOfWorkManager } from '../../transactions/index.js';
import { EventSequenceId } from '../EventSequenceId.js';
import type { IEventSequence } from '../IEventSequence.js';
import { TransactionalEventSequence } from '../TransactionalEventSequence.js';

chai.should();

function a_transactional_sequence() {
    const addEvent = vi.fn();
    const manager = { current: { addEvent } } as unknown as IUnitOfWorkManager;
    return { sequence: new TransactionalEventSequence({ id: EventSequenceId.eventLog } as IEventSequence, manager), addEvent };
}

describe('when appending many events transactionally with shared named tags', () => {
    let addEvent: ReturnType<typeof vi.fn>;
    beforeEach(async () => {
        const given = a_transactional_sequence();
        addEvent = given.addEvent;
        await given.sequence.appendMany('source', [{ one: 1 }, { two: 2 }], { eventSource: 'Account', namedTags: [new NamedTag('import', 'i-1')] });
    });
    it('should add every event with the shared named tags and routing', () =>
        addEvent.mock.calls.map(call => [call[3].eventSource, call[3].namedTags.map((tag: NamedTag) => tag.value)])
            .should.deep.equal([['Account', ['i-1']], ['Account', ['i-1']]]));
});

describe('when appending many events transactionally with an invalid named tag', () => {
    let addEvent: ReturnType<typeof vi.fn>;
    let error: unknown;
    beforeEach(async () => {
        const given = a_transactional_sequence();
        addEvent = given.addEvent;
        error = await given.sequence.appendMany('source', [{ one: 1 }], { namedTags: [{ name: '', value: '' } as NamedTag] }).catch(caught => caught);
    });
    it('should fail with an invalid named tag error', () => (error as Error).should.be.instanceOf(InvalidNamedTag));
    it('should not add any event', () => addEvent.mock.calls.should.have.lengthOf(0));
});
