// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { EventContext, EventType, ObservationState, ReplayState, type ReducerMessage } from '@cratis/chronicle.contracts';
import { beforeEach, chai, describe, it } from 'vitest';
import type { IClientArtifactsProvider } from '../../artifacts/index.js';
import type { ChronicleConnection } from '../../connection/index.js';
import { ConnectionLifecycle } from '../../connection/ConnectionLifecycle.js';
import type { IEventStore } from '../../IEventStore.js';
import { eventType } from '../../events/eventTypeDecorator.js';
import { handles, reducer, Reducers } from '../index.js';

chai.should();

@eventType('field-reducer-event')
class AuthorRegistered {}
const calls: string[] = [];
class Base {
    @handles(AuthorRegistered) update() { calls.push('base'); return {}; }
    beginReplay() { calls.push('replay'); }
    endReplay() {}
}
@reducer('field-reducer')
class Derived extends Base {
    override update = () => { calls.push('field'); return {}; };
}

for (const replayState of [ReplayState.REPLAY_STATE_None, ReplayState.BeginReplay]) {
    describe(`when activating a reducer with a field override for replay state ${replayState}`, () => {
        let result: ReducerMessage;
        let disposed: boolean;
        beforeEach(async () => {
            calls.length = 0;
            disposed = false;
            const lifecycle = new ConnectionLifecycle();
            let finish!: () => void;
            const finished = new Promise<void>(resolve => { finish = resolve; });
            async function* stream(queue: AsyncIterable<ReducerMessage>) {
                const messages = queue[Symbol.asyncIterator]();
                await messages.next();
                yield { Events: [{ Content: '{}', Context: EventContext.fromPartial({
                    EventType: EventType.fromPartial({ Id: 'field-reducer-event', Generation: 1 }), SequenceNumber: 1n
                }) }], Partition: 'author', ReplayState: replayState, InitialState: '' };
                result = (await messages.next()).value!;
                await lifecycle.disconnected(error => { throw error; });
                finish();
            }
            const reducers = new Reducers({ reducers: [Derived], eventTypes: [AuthorRegistered], readModels: [] } as unknown as IClientArtifactsProvider,
                { reducers: { observe: stream }, readModels: { registerMany: async () => ({}) } } as unknown as ChronicleConnection,
                'store', 'tenant', lifecycle, 'sink', { readModels: {} } as IEventStore,
                type => ({ instance: new type(), dispose: () => { disposed = true; } }));
            try { await reducers.register(); await finished; } finally { reducers.dispose(); }
        });
        it('should fail delivery without invoking the field or replay notification', () => {
            calls.should.have.lengthOf(0);
            result.Content!.Value1!.State.should.equal(ObservationState.Failed);
            result.Content!.Value1!.ReadModelState.should.equal('');
            result.Content!.Value1!.ExceptionMessages.join(' ').should.contain(
                "Override 'update' on 'Derived' hides @handles(AuthorRegistered) declared on 'Base'; use a method with @handles instead of an instance field.");
        });
        it('should release the rejected activation lease', () => { disposed.should.be.true; });
    });
}
