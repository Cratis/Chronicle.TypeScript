// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { EventContext, EventObservationState, EventType, ObservationState, ReplayState, type ReactorMessage } from '@cratis/chronicle.contracts';
import { beforeEach, chai, describe, it } from 'vitest';
import type { IClientArtifactsProvider } from '../../artifacts/index.js';
import type { ChronicleConnection } from '../../connection/index.js';
import { ConnectionLifecycle } from '../../connection/ConnectionLifecycle.js';
import type { IEventLog } from '../../eventSequences/IEventLog.js';
import type { IEventStore } from '../../IEventStore.js';
import { eventType } from '../../events/eventTypeDecorator.js';
import { handles, reactor, Reactors, replay } from '../index.js';

chai.should();

@eventType('instance-reactor-event')
class AuthorRegistered {}
const calls: string[] = [];

@reactor('bound-conventional-reactor')
class BoundConventional {
    readonly marker = 'bound conventional';
    constructor() { this.authorRegistered = this.authorRegistered.bind(this); }
    authorRegistered() { calls.push(this.marker); }
}

@reactor('bound-explicit-reactor')
class BoundExplicit {
    readonly marker = 'bound explicit';
    constructor() { this.notify = this.notify.bind(this); }
    @handles(AuthorRegistered)
    notify() { calls.push(this.marker); }
}

class Conventional {
    authorRegistered() { calls.push('base'); }
}

@reactor('field-conventional-reactor')
class FieldConventional extends Conventional {
    override authorRegistered = () => { calls.push('field conventional'); };
}

@reactor('bound-replay-reactor')
class BoundReplay {
    readonly marker = 'bound replay';
    constructor() { this.restore = this.restore.bind(this); }
    @replay(AuthorRegistered)
    restore() { calls.push(this.marker); }
}

class Replay {
    @replay(AuthorRegistered)
    restore() { calls.push('base replay'); }
}

@reactor('field-replay-reactor')
class FieldReplay extends Replay {
    override restore = () => { calls.push('field replay'); };
}

for (const { type, expected, observationState } of [
    { type: BoundConventional, expected: 'bound conventional', observationState: EventObservationState.Initial },
    { type: BoundExplicit, expected: 'bound explicit', observationState: EventObservationState.Initial },
    { type: FieldConventional, expected: 'field conventional', observationState: EventObservationState.Initial },
    { type: BoundReplay, expected: 'bound replay', observationState: EventObservationState.Replay },
    { type: FieldReplay, expected: 'field replay', observationState: EventObservationState.Replay }
]) {
    describe(`when delivering to the ${expected} reactor handler without an activator`, () => {
        let result: ReactorMessage;
        beforeEach(async () => {
            calls.length = 0;
            const lifecycle = new ConnectionLifecycle();
            let finish!: () => void;
            const finished = new Promise<void>(resolve => { finish = resolve; });
            async function* stream(queue: AsyncIterable<ReactorMessage>) {
                const messages = queue[Symbol.asyncIterator]();
                await messages.next();
                yield { Events: [{ Content: '{}', Context: EventContext.fromPartial({
                    EventType: EventType.fromPartial({ Id: 'instance-reactor-event', Generation: 1 }), SequenceNumber: 1n,
                    ObservationState: observationState
                }) }], Partition: 'author', ReplayState: ReplayState.REPLAY_STATE_None, InitialState: '' };
                result = (await messages.next()).value!;
                await lifecycle.disconnected(error => { throw error; });
                finish();
            }
            const reactors = new Reactors({ reactors: [type], eventTypes: [AuthorRegistered] } as unknown as IClientArtifactsProvider,
                { reactors: { observe: stream } } as unknown as ChronicleConnection, 'store', 'tenant', lifecycle, {} as IEventLog,
                undefined, { readModels: {} } as IEventStore);
            try { await reactors.register(); await finished; } finally { reactors.dispose(); }
        });
        it('should invoke the instance handler', () => { calls.should.deep.equal([expected]); });
        it('should complete delivery', () => { result.Content!.Value1!.State.should.equal(ObservationState.Success); });
    });
}
