// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { EventContext, EventType, ObservationState, ReplayState, type ReactorMessage } from '@cratis/chronicle.contracts';
import { beforeEach, chai, describe, it } from 'vitest';
import type { IClientArtifactsProvider } from '../../artifacts/index.js';
import type { ChronicleConnection } from '../../connection/index.js';
import { ConnectionLifecycle } from '../../connection/ConnectionLifecycle.js';
import type { IEventLog } from '../../eventSequences/IEventLog.js';
import type { IEventStore } from '../../IEventStore.js';
import { eventType } from '../../events/eventTypeDecorator.js';
import { handles, reactor, Reactors } from '../index.js';

chai.should();

@eventType('field-reactor-event')
class AuthorRegistered {}
const calls: string[] = [];
class Base {
    @handles(AuthorRegistered) notify() { calls.push('base'); }
    beginReplay() { calls.push('replay'); }
    endReplay() {}
}
@reactor('field-reactor')
class Derived extends Base {
    override notify = () => { calls.push('field'); };
}

for (const replayState of [ReplayState.REPLAY_STATE_None, ReplayState.BeginReplay]) {
    describe(`when activating a reactor with a field override for replay state ${replayState}`, () => {
        let result: ReactorMessage;
        let disposed: boolean;
        beforeEach(async () => {
            calls.length = 0;
            disposed = false;
            const lifecycle = new ConnectionLifecycle();
            let finish!: () => void;
            const finished = new Promise<void>(resolve => { finish = resolve; });
            async function* stream(queue: AsyncIterable<ReactorMessage>) {
                const messages = queue[Symbol.asyncIterator]();
                await messages.next();
                yield { Events: [{ Content: '{}', Context: EventContext.fromPartial({
                    EventType: EventType.fromPartial({ Id: 'field-reactor-event', Generation: 1 }), SequenceNumber: 1n
                }) }], Partition: 'author', ReplayState: replayState, InitialState: '' };
                result = (await messages.next()).value!;
                await lifecycle.disconnected(error => { throw error; });
                finish();
            }
            const reactors = new Reactors({ reactors: [Derived], eventTypes: [AuthorRegistered] } as unknown as IClientArtifactsProvider,
                { reactors: { observe: stream } } as unknown as ChronicleConnection, 'store', 'tenant', lifecycle, {} as IEventLog,
                undefined, { readModels: {} } as IEventStore, type => ({ instance: new type(), dispose: () => { disposed = true; } }));
            try { await reactors.register(); await finished; } finally { reactors.dispose(); }
        });
        it('should fail delivery without invoking the field or replay notification', () => {
            calls.should.have.lengthOf(0);
            result.Content!.Value1!.State.should.equal(ObservationState.Failed);
            result.Content!.Value1!.ExceptionMessages.join(' ').should.contain(
                "Override 'notify' on 'Derived' hides @handles(AuthorRegistered) declared on 'Base'; use a method with @handles instead of an instance field.");
        });
        it('should release the rejected activation lease', () => { disposed.should.be.true; });
    });
}
