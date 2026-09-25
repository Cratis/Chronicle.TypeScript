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
class OnceOnlyReactor {
    somethingHappened() { invoked.push('live'); }
}

@reactor('inherited-once-only-policy')
class InheritedOnceOnlyReactor extends OnceOnlyReactor {}

@reactor('method-once-only-policy')
class MethodOnceOnlyReactor {
    @onceOnly()
    somethingHappened() { invoked.push('live'); }
}

@reactor('replay-alternative-policy')
class AlternativeReactor {
    @onceOnly()
    somethingHappened() { invoked.push('live'); }

    @replay()
    replaySomethingHappened(event: SomethingHappened) { invoked.push(`replay:${event.value}`); }
}

@reactor('plain-replay-alternative-policy')
class PlainAlternativeReactor {
    somethingHappened() { invoked.push('live'); }

    @replay()
    replaySomethingHappened(event: SomethingHappened) { invoked.push(`replay:${event.value}`); }
}

@reactor('inherited-replay-policy')
class InheritedReplayReactor extends PlainAlternativeReactor {}

@reactor('overridden-replay-policy')
class OverriddenReplayReactor extends PlainAlternativeReactor {
    @replay()
    replaySomethingHappened(event: SomethingHappened) { invoked.push(`derived:${event.value}`); }
}

@reactor('replay-marked-live-handler-policy')
class ReplayMarkedLiveHandlerReactor {
    @replay(SomethingHappened)
    somethingHappened() { invoked.push('replay'); }
}

@reactor('unknown-replay-policy')
class UnknownReplayReactor {
    @replay()
    replayWrongName() {}
}

class UnknownEvent {}

@reactor('unregistered-replay-policy')
class UnregisteredReplayReactor {
    @replay(UnknownEvent)
    rebuild() {}
}

@reactor('duplicate-replay-policy')
class DuplicateReplayReactor {
    @replay()
    replaySomethingHappened() {}

    @replay(SomethingHappened)
    rebuild() {}
}

@reactor('once-only-replay-handler-policy')
class OnceOnlyReplayHandlerReactor {
    somethingHappened() { invoked.push('live'); }

    @onceOnly()
    @replay()
    replaySomethingHappened() { invoked.push('replay'); }
}

@reactor('replay-only-policy')
class ReplayOnlyReactor {
    @replay(SomethingHappened)
    rebuild(event: SomethingHappened) { invoked.push(`replay:${event.value}`); }
}

describe('reactor replay policy', () => {
    it('registers reactors as replayable by default and dispatches ordinary handlers for both deliveries', async () => {
        invoked = [];
        const delivery = await observe(DefaultReactor, [EventObservationState.Initial, EventObservationState.Replay]);
        expect(delivery.registration?.IsReplayable).toBe(true);
        expect(invoked).toEqual(['live:hello', 'live:hello']);
    });

    it('registers a class marked onceOnly as non-replayable', async () => {
        invoked = [];
        const delivery = await observe(OnceOnlyReactor, [EventObservationState.Initial]);
        expect(delivery.registration?.IsReplayable).toBe(false);
        expect(invoked).toEqual(['live']);
    });

    it('does not inherit a class-level onceOnly marker on registration', async () => {
        invoked = [];
        const delivery = await observe(InheritedOnceOnlyReactor, [EventObservationState.Initial, EventObservationState.Replay]);
        expect(delivery.registration?.IsReplayable).toBe(true);
        expect(invoked).toEqual(['live', 'live']);
    });

    it('skips a method-level onceOnly handler only for replayed events and acknowledges both', async () => {
        invoked = [];
        const delivery = await observe(MethodOnceOnlyReactor, [EventObservationState.Initial, EventObservationState.Replay]);
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

    it('runs only the alternative replay handler when both handlers are plain', async () => {
        invoked = [];
        await observe(PlainAlternativeReactor, [EventObservationState.Initial, EventObservationState.Replay]);
        expect(invoked).toEqual(['live', 'replay:hello']);
    });

    it('discovers an inherited replay handler', async () => {
        invoked = [];
        await observe(InheritedReplayReactor, [EventObservationState.Initial, EventObservationState.Replay]);
        expect(invoked).toEqual(['live', 'replay:hello']);
    });

    it('prefers a derived replay handler to the inherited one', async () => {
        invoked = [];
        await observe(OverriddenReplayReactor, [EventObservationState.Initial, EventObservationState.Replay]);
        expect(invoked).toEqual(['live', 'derived:hello']);
    });

    it('does not invoke a replay-marked live-named handler on live delivery', async () => {
        invoked = [];
        await observe(ReplayMarkedLiveHandlerReactor, [EventObservationState.Initial, EventObservationState.Replay]);
        expect(invoked).toEqual(['replay']);
    });

    it('rejects a convention replay handler with no registered event type', async () => {
        await expect(observe(UnknownReplayReactor, [])).rejects.toThrow(/replayWrongName.*no registered event type/);
    });

    it('rejects an explicit replay handler for an unregistered event type', async () => {
        await expect(observe(UnregisteredReplayReactor, [])).rejects.toThrow(/rebuild.*no registered event type/);
    });

    it('rejects two replay handlers for the same event type', async () => {
        await expect(observe(DuplicateReplayReactor, [])).rejects.toThrow(/multiple replay handlers.*reactor-replay-event/);
    });

    it('rejects a static legacy replay method', () => {
        expect(() => {
            class StaticReplayReactor {
                @replay(SomethingHappened)
                static rebuild() {}
            }
            return StaticReplayReactor;
        }).toThrow('Replay requires a public instance method.');
    });

    it('does not fall back to the ordinary handler when the replay handler is onceOnly', async () => {
        invoked = [];
        const delivery = await observe(OnceOnlyReplayHandlerReactor, [EventObservationState.Initial, EventObservationState.Replay]);
        expect(invoked).toEqual(['live']);
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
