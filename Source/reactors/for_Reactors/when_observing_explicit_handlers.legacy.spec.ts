// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { EventContext, EventObservationState, EventType, type ReactorMessage } from '@cratis/chronicle.contracts';
import { beforeEach, chai, describe, it } from 'vitest';
import type { IClientArtifactsProvider } from '../../artifacts/index.js';
import type { ChronicleConnection } from '../../connection/index.js';
import { ConnectionLifecycle } from '../../connection/ConnectionLifecycle.js';
import type { IEventLog } from '../../eventSequences/IEventLog.js';
import { eventType } from '../../events/eventTypeDecorator.js';
import { handles, onceOnly, reactor, Reactors, replay } from '../index.js';

chai.should();

@eventType('legacy-delivered-handler')
class AuthorRegistered { constructor(readonly name = '') {} }

const calls: string[] = [];
@reactor('legacy-delivery')
class AuthorReactor {
    @handles(AuthorRegistered)
    @onceOnly()
    notify(event: AuthorRegistered) { calls.push(`live:${event.name}`); }
}
@reactor('legacy-delivery-with-replay')
class ReplayAuthorReactor extends AuthorReactor {
    @replay(AuthorRegistered)
    rebuild(event: AuthorRegistered) { calls.push(`replay:${event.name}`); }
}

for (const [type, expected] of [
    [AuthorReactor, ['live:Ada']],
    [ReplayAuthorReactor, ['live:Ada', 'replay:Ada']]
] as const) {
    describe(`when observing live and replay events with explicit legacy handlers on ${type.name}`, () => {
        let registration: ReactorMessage;
        let result: ReactorMessage;
        beforeEach(async () => {
            calls.length = 0;
            const lifecycle = new ConnectionLifecycle();
            let finish!: () => void;
            const finished = new Promise<void>(resolve => { finish = resolve; });
            async function* stream(queue: AsyncIterable<ReactorMessage>) {
                const messages = queue[Symbol.asyncIterator]();
                registration = (await messages.next()).value!;
                yield {
                    Events: [EventObservationState.Initial, EventObservationState.Replay].map((state, index) => ({
                        Context: EventContext.fromPartial({
                            EventType: EventType.fromPartial({ Id: 'legacy-delivered-handler', Generation: 1 }),
                            SequenceNumber: BigInt(index + 1), ObservationState: state
                        }),
                        Content: JSON.stringify({ name: 'Ada' })
                    })),
                    Partition: 'author', ReplayState: 0, InitialState: ''
                };
                result = (await messages.next()).value!;
                await lifecycle.disconnected(error => { throw error; });
                finish();
            }
            const connection = { reactors: { observe: stream } } as unknown as ChronicleConnection;
            const artifacts = { reactors: [type], eventTypes: [AuthorRegistered] } as unknown as IClientArtifactsProvider;
            const reactors = new Reactors(artifacts, connection, 'store', 'tenant', lifecycle, {} as IEventLog);
            try {
                await reactors.register();
                await finished;
            } finally { reactors.dispose(); }
        });
        it('should subscribe to the explicitly named event type', () => {
            registration.Content!.Value0!.Reactor!.EventTypes.map(entry => entry.EventType!.Id)
                .should.deep.equal(['legacy-delivered-handler']);
        });
        it('should invoke only the appropriate handlers', () => { calls.should.deep.equal(expected); });
        it('should acknowledge both deliveries', () => {
            result.Content!.Value1!.LastSuccessfulObservation.should.equal(2n);
        });
    });
}
