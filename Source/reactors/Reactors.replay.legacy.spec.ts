// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { EventContext, EventObservationState, EventType, ReactorMessage } from '@cratis/chronicle.contracts';
import { describe, expect, it } from 'vitest';
import type { IClientArtifactsProvider } from '../artifacts/index.js';
import type { ChronicleConnection } from '../connection/index.js';
import { ConnectionLifecycle } from '../connection/ConnectionLifecycle.js';
import type { IEventLog } from '../eventSequences/IEventLog.js';
import { eventType } from '../events/eventTypeDecorator.js';
import { onceOnly } from './onceOnly.js';
import { reactor } from './reactor.js';
import { Reactors } from './Reactors.js';
import { replay } from './replay.js';
import { replayable } from './replayable.js';

@eventType('reactor-replay-event')
class SomethingHappened {
    constructor(readonly value: string = '') {}
}

async function observe(type: Function, states: EventObservationState[]) {
    const lifecycle = new ConnectionLifecycle();
    let registration!: ReactorMessage;
    let result!: ReactorMessage;
    let finish!: () => void;
    const finished = new Promise<void>(resolve => { finish = resolve; });
    async function* stream(queue: AsyncIterable<ReactorMessage>) {
        const messages = queue[Symbol.asyncIterator]();
        registration = (await messages.next()).value!;
        yield {
            Events: states.map((state, index) => ({
                Context: EventContext.fromPartial({
                    EventType: EventType.fromPartial({ Id: 'reactor-replay-event', Generation: 1 }),
                    SequenceNumber: BigInt(index + 1), ObservationState: state
                }),
                Content: JSON.stringify({ value: 'hello' })
            })),
            Partition: 'source', ReplayState: 0, InitialState: ''
        };
        result = (await messages.next()).value!;
        await lifecycle.disconnected(error => { throw error; });
        finish();
    }
    const connection = { reactors: { observe: stream } } as unknown as ChronicleConnection;
    const artifacts = { reactors: [type], eventTypes: [SomethingHappened] } as unknown as IClientArtifactsProvider;
    await new Reactors(artifacts, connection, 'store', 'tenant', lifecycle, {} as IEventLog).register();
    await finished;
    return { registration: registration.Content?.Value0?.Reactor, result: result.Content?.Value1 };
}

// The client constructs reactor instances; share a sink for assertions across that boundary.
let invoked: string[] = [];

@reactor('default-replay-policy')
class DefaultReactor {
    somethingHappened(event: SomethingHappened) { invoked.push(`live:${event.value}`); }
}

@reactor('once-only-replay-policy')
@onceOnly()
@replayable()
class OnceOnlyReactor {
    somethingHappened() { invoked.push('live'); }
}

@reactor('opt-in-replay-policy')
@replayable()
class ReplayableReactor {
    @onceOnly()
    somethingHappened() { invoked.push('live'); }
}

@reactor('replay-alternative-policy')
@replayable()
class AlternativeReactor {
    @onceOnly()
    somethingHappened() { invoked.push('live'); }

    @replay()
    replaySomethingHappened(event: SomethingHappened) { invoked.push(`replay:${event.value}`); }
}

@reactor('replay-only-policy')
@replayable()
class ReplayOnlyReactor {
    @replay(SomethingHappened)
    rebuild(event: SomethingHappened) { invoked.push(`replay:${event.value}`); }
}

describe('reactor replay policy', () => {
    it('preserves the non-replayable registration default and ordinary handler dispatch', async () => {
        invoked = [];
        const delivery = await observe(DefaultReactor, [EventObservationState.Initial, EventObservationState.Replay]);
        expect(delivery.registration?.IsReplayable).toBe(false);
        expect(invoked).toEqual(['live:hello', 'live:hello']);
    });

    it('class-level onceOnly overrides replay opt-in', async () => {
        invoked = [];
        const delivery = await observe(OnceOnlyReactor, [EventObservationState.Initial]);
        expect(delivery.registration?.IsReplayable).toBe(false);
        expect(invoked).toEqual(['live']);
    });

    it('skips a method-level onceOnly handler only for replayed events and acknowledges both', async () => {
        invoked = [];
        const delivery = await observe(ReplayableReactor, [EventObservationState.Initial, EventObservationState.Replay]);
        expect(delivery.registration?.IsReplayable).toBe(true);
        expect(invoked).toEqual(['live']);
        expect(delivery.result?.LastSuccessfulObservation).toBe(2n);
    });

    it('runs the replay-specific handler instead of the ordinary handler during replay', async () => {
        invoked = [];
        const delivery = await observe(AlternativeReactor, [EventObservationState.Initial, EventObservationState.Replay]);
        expect(invoked).toEqual(['live', 'replay:hello']);
        expect(delivery.result?.LastSuccessfulObservation).toBe(2n);
    });

    it('subscribes to an event handled only during replay and acknowledges live deliveries', async () => {
        invoked = [];
        const delivery = await observe(ReplayOnlyReactor, [EventObservationState.Initial, EventObservationState.Replay]);
        expect(delivery.registration?.EventTypes).toHaveLength(1);
        expect(invoked).toEqual(['replay:hello']);
        expect(delivery.result?.LastSuccessfulObservation).toBe(2n);
    });
});
