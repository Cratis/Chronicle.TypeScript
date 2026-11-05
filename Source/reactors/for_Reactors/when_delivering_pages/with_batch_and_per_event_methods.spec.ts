// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { ObservationOrigin as ContractObservationOrigin, ObservationState, type RegisterReactor, type ReactorResult } from '@cratis/chronicle.contracts';
import type { EventContext } from '../../../events/EventContext.js';
import { eventType } from '../../../events/eventTypeDecorator.js';
import { BatchContext, EventBatch, ObservationOrigin, observes } from '../../../observation/index.js';
import { reactor } from '../../reactor.js';
import { appended, observeReactorMessages, page } from '../given/observe_reactor_messages.js';

chai.should();

@eventType('batch-user-registered')
class UserRegistered {
    constructor(readonly name: string = '') {}
}

@eventType('batch-user-renamed')
class UserRenamed {
    constructor(readonly newName: string = '') {}
}

@eventType('batch-user-email-changed')
class UserEmailChanged {}

describe('when delivering a page to a reactor with a batch method and a per-event method', () => {
    let batches: { names: string[]; partitions: readonly string[] }[];
    let contexts: BatchContext[];
    let perEvent: string[];
    let registration: RegisterReactor;
    let results: ReactorResult[];

    beforeEach(async () => {
        batches = [];
        contexts = [];
        perEvent = [];

        @reactor('batch-users')
        class Users {
            @observes(UserRegistered)
            @observes(UserRenamed)
            index(batch: EventBatch, context: BatchContext): void {
                contexts.push(context);
                batches.push({
                    names: batch.events.map(entry => entry.is(UserRegistered) ? entry.event.name : entry.is(UserRenamed) ? entry.event.newName : '?'),
                    partitions: batch.partitions
                });
            }

            userEmailChanged(_event: UserEmailChanged, context: EventContext) {
                perEvent.push(`${context.eventSourceId}:${context.sequenceNumber}`);
            }
        }

        ({ registration, results } = await observeReactorMessages(Users, [UserRegistered, UserRenamed, UserEmailChanged], [page(7n, {
            alice: [appended('batch-user-registered', 'alice', 1n, { name: 'Alice' }), appended('batch-user-email-changed', 'alice', 3n),
                appended('batch-user-renamed', 'alice', 4n, { newName: 'Alicia' })],
            bob: [appended('batch-user-registered', 'bob', 2n, { name: 'Bob' })]
        }, ContractObservationOrigin.CatchingUp)]));
    });

    it('should register the event types of both methods', () =>
        registration.Reactor!.EventTypes.map(eventType => eventType.EventType!.Id).sort()
            .should.deep.equal(['batch-user-email-changed', 'batch-user-registered', 'batch-user-renamed']));
    it('should call the batch method once with its event types across partitions in sequence order', () =>
        batches.should.deep.equal([{ names: ['Alice', 'Bob', 'Alicia'], partitions: ['alice', 'bob'] }]));
    it('should call the per-event method only for its own event type', () => perEvent.should.deep.equal(['alice:3']));
    it('should describe the page in the batch context', () => {
        contexts[0].origin.should.equal(ObservationOrigin.CatchUp);
        contexts[0].observerId.should.equal('batch-users');
        contexts[0].partitions.should.deep.equal(['alice', 'bob']);
        contexts[0].eventCount.should.equal(4);
        contexts[0].firstSequenceNumber!.should.equal(1n);
        contexts[0].lastSequenceNumber!.should.equal(4n);
        contexts[0].canDefer.should.be.true;
    });
    it('should settle every partition at its last event', () =>
        results[0].Partitions.map(result => [result.Partition, result.State, result.LastSuccessfulObservation])
            .should.deep.equal([['alice', ObservationState.Success, 4n], ['bob', ObservationState.Success, 2n]]));
});
