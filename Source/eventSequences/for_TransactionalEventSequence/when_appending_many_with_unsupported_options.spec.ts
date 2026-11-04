// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it, vi, type Mock } from 'vitest';
import type { AppendOptions } from '../AppendOptions.js';
import { EventSequenceId } from '../EventSequenceId.js';
import type { IEventSequence } from '../IEventSequence.js';
import type { IUnitOfWorkManager } from '../../transactions/IUnitOfWorkManager.js';
import { AppendOptionNotSupportedInUnitOfWork } from '../../transactions/AppendOptionNotSupportedInUnitOfWork.js';
import { TransactionalEventSequence } from '../TransactionalEventSequence.js';

chai.should();

for (const events of [[{ order: 0 }, { order: 1 }], []]) {
    describe(`when appending ${events.length} events with unsupported options to a transactional event sequence`, () => {
        let addEvent: Mock;
        let error: unknown;

        beforeEach(async () => {
            addEvent = vi.fn();
            error = undefined;
            const manager = { current: { addEvent } } as unknown as IUnitOfWorkManager;
            const sequence = new TransactionalEventSequence({ id: EventSequenceId.eventLog } as unknown as IEventSequence, manager);
            const options: AppendOptions = { correlationId: 'private-correlation-id' };
            try {
                await sequence.appendMany('a-1', events, options);
            } catch (caught) {
                error = caught;
            }
        });

        it('should reject the unsupported option', () => error!.should.be.instanceOf(AppendOptionNotSupportedInUnitOfWork));
        it('should not enroll any event', () => addEvent.mock.calls.should.have.lengthOf(0));
    });
}
