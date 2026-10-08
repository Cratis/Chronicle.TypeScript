// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it, vi, type Mock } from 'vitest';
import { EventSequenceId } from '../EventSequenceId.js';
import type { IEventSequence } from '../IEventSequence.js';
import type { IUnitOfWorkManager } from '../../transactions/IUnitOfWorkManager.js';
import type { TransactionalAppendOptions } from '../../transactions/TransactionalAppendOptions.js';
import { TransactionalEventSequence } from '../TransactionalEventSequence.js';

chai.should();

describe('when appending many with options to a transactional event sequence', () => {
    const outbox = new EventSequenceId('outbox');
    const options: TransactionalAppendOptions = { subject: 'subject-1', occurred: new Date(0), tags: ['t'], concurrencyScope: { sequenceNumber: 2n } };
    let addEvent: Mock;

    beforeEach(async () => {
        addEvent = vi.fn();
        const manager = { current: { addEvent } } as unknown as IUnitOfWorkManager;
        const sequence = new TransactionalEventSequence({ id: outbox } as unknown as IEventSequence, manager);
        await sequence.appendMany('a-1', [{ order: 0 }, { order: 1 }], options);
    });

    it('should enroll every event with the options in order', () => addEvent.mock.calls.should.deep.equal([
        [outbox, 'a-1', { order: 0 }, options],
        [outbox, 'a-1', { order: 1 }, options]
    ]));
});
