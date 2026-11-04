// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it, vi, type Mock } from 'vitest';
import { EventSequenceId } from '../EventSequenceId.js';
import type { IEventSequence } from '../IEventSequence.js';
import type { IUnitOfWorkManager } from '../../transactions/IUnitOfWorkManager.js';
import { TransactionalEventSequence } from '../TransactionalEventSequence.js';

chai.should();

describe('when appending many with append option names to a transactional event sequence', () => {
    let addEvent: Mock;

    beforeEach(async () => {
        addEvent = vi.fn();
        const manager = { current: { addEvent } } as unknown as IUnitOfWorkManager;
        const sequence = new TransactionalEventSequence({ id: EventSequenceId.eventLog } as unknown as IEventSequence, manager);
        await sequence.appendMany('a-1', [{ order: 0 }, { order: 1 }], { streamId: 'order-1', subject: 's' });
    });

    it('should enroll every event with normalized options', () => addEvent.mock.calls.should.deep.equal([
        [EventSequenceId.eventLog, 'a-1', { order: 0 }, { subject: 's', eventStreamId: 'order-1' }],
        [EventSequenceId.eventLog, 'a-1', { order: 1 }, { subject: 's', eventStreamId: 'order-1' }]
    ]));
});
