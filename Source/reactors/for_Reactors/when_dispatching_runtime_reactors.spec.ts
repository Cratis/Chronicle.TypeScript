// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { afterEach, beforeEach, chai, describe, it, vi } from 'vitest';
import { ObservationState } from '@cratis/chronicle.contracts';
import type { EventContext } from '../../events/EventContext.js';
import { Registered, Other, runtime_reactors } from './given/runtime_reactors.fixture.js';
import { appended, page, single } from './given/observe_reactor_messages.js';

chai.should();

describe('when delivering to fluent callbacks', () => {
    let context: runtime_reactors;
    let event: Registered;
    let received: EventContext;
    let calls: string[];
    beforeEach(async () => {
        context = new runtime_reactors();
        calls = [];
        await context.reactors.register('fluent', builder => builder
            .on(Registered, async (value, metadata) => { event = value; received = metadata; calls.push('typed'); })
            .on(Registered, () => { calls.push('second'); })
            .subscribe(() => { calls.push('all'); }));
        context.attempts[0].incoming.send(single('one', [appended('runtime-registered', 'one', 4n, { value: 'hello' }), appended('runtime-other', 'one', 5n)]));
        await vi.waitFor(() => context.attempts[0].sent.length.should.equal(2));
    });
    afterEach(() => context.reactors.dispose());
    it('should hydrate the requested constructor', () => {
        event.should.be.instanceOf(Registered);
        event.value.should.equal('hello');
    });
    it('should convert the event context', () => {
        received.eventSourceId.should.equal('one');
        received.sequenceNumber.should.equal(4n);
        received.eventType.id.value.should.equal('runtime-registered');
    });
    it('should dispatch each matching callback once and then the catch-all', () => calls.should.deep.equal(['typed', 'second', 'all', 'all']));
    it('should acknowledge the last handled event', () => context.attempts[0].sent[1].Content!.Value1!.LastSuccessfulObservation.should.equal(5n));
});

describe('when an asynchronous delegate is still running', () => {
    let context: runtime_reactors;
    let release: () => void;
    let callbackSignal: AbortSignal;
    beforeEach(async () => {
        context = new runtime_reactors();
        let entered!: () => void;
        const started = new Promise<void>(resolve => { entered = resolve; });
        const blocked = new Promise<void>(resolve => { release = resolve; });
        await context.reactors.register('delegate', builder => builder.withEventType(Registered), async (event, signal) => {
            event.context.eventType.id.value.should.equal('runtime-registered');
            callbackSignal = signal;
            entered();
            await blocked;
        });
        context.attempts[0].incoming.send(single('one', [appended('runtime-registered', 'one', 8n)]));
        await started;
    });
    afterEach(() => { release(); context.reactors.dispose(); });
    it('should pass the observation signal', () => callbackSignal.should.equal(context.attempts[0].signal));
    it('should not acknowledge before the callback finishes', () => context.attempts[0].sent.length.should.equal(1));
});

describe('when a delegate rejects one partition of a page', () => {
    let context: runtime_reactors;
    let calls: bigint[];
    let reconnect: ReturnType<typeof vi.fn>;
    beforeEach(async () => {
        context = new runtime_reactors();
        calls = [];
        reconnect = vi.fn();
        context.lifecycle.onReconnectRequested(reconnect);
        await context.reactors.register('delegate', builder => builder.withEventType(Registered).withEventType(Other), async event => {
            calls.push(event.context.sequenceNumber);
            if (event.context.sequenceNumber === 2n) throw new Error('callback failed');
        });
        context.attempts[0].incoming.send(page(90n, {
            one: [appended('runtime-registered', 'one', 1n), appended('runtime-registered', 'one', 2n), appended('runtime-registered', 'one', 3n)],
            two: [appended('runtime-other', 'two', 4n)]
        }));
        await vi.waitFor(() => context.attempts[0].sent.length.should.equal(2));
    });
    afterEach(() => context.reactors.dispose());
    it('should stop only the failed partition', () => calls.should.deep.equal([1n, 2n, 4n]));
    it('should preserve the last successful sequence and failed state', () => {
        const result = context.attempts[0].sent[1].Content!.Value1!;
        result.DeliveryId.should.equal(90n);
        result.Partitions[0].State.should.equal(ObservationState.Failed);
        result.Partitions[0].LastSuccessfulObservation.should.equal(1n);
        result.Partitions[0].ExceptionMessages.join(' ').should.contain('callback failed');
        result.Partitions[1].LastSuccessfulObservation.should.equal(4n);
    });
    it('should not treat a callback failure as session loss', () => reconnect.mock.calls.length.should.equal(0));
});
