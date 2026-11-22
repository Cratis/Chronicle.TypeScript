// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { afterEach, beforeEach, chai, describe, it, vi } from 'vitest';
import { ClientError, Status } from 'nice-grpc';
import { Registered, runtime_reactors } from './given/runtime_reactors.fixture.js';
import { reactor } from '../reactor.js';
import { appended, single } from './given/observe_reactor_messages.js';

chai.should();

@reactor('removable-artifact')
class Discovered { registered() {} }

for (const remove of [false, true]) {
    describe(`when reconnecting ${remove ? 'after unregistering' : 'with retained runtime definitions'}`, () => {
        let context: runtime_reactors;
        let oldSignal: AbortSignal;
        beforeEach(async () => {
            context = new runtime_reactors();
            await context.reactors.register('fluent', builder => builder.on(Registered, () => {}));
            await context.reactors.register('delegate', builder => builder.withEventType(Registered), () => {});
            oldSignal = context.attempts[0].signal;
            if (remove) await context.reactors.unregister('fluent');
            await context.lifecycle.disconnected(error => { throw error; });
            await context.reactors.register();
        });
        afterEach(() => context.reactors.dispose());
        it('should cancel the previous attempt', () => oldSignal.aborted.should.be.true);
        it('should restore only eligible identities once', () => context.observe.mock.calls.length.should.equal(remove ? 3 : 4));
        it('should not duplicate repeated restoration', async () => {
            await context.reactors.register();
            context.observe.mock.calls.length.should.equal(remove ? 3 : 4);
        });
    });
}

describe('when unregistering a discovered reactor', () => {
    let context: runtime_reactors;
    beforeEach(async () => {
        context = new runtime_reactors();
        context.artifacts.push(Discovered);
        await context.reactors.register();
        await context.reactors.unregister('removable-artifact');
        await context.reactors.discover();
        await context.lifecycle.disconnected(error => { throw error; });
        await context.reactors.register();
        await context.reactors.unregister('absent');
    });
    afterEach(() => context.reactors.dispose());
    it('should suppress rediscovery and make an unknown unregister harmless', () => context.observe.mock.calls.length.should.equal(1));
});

describe('when replacing an ID while its old delegate is in flight', () => {
    let context: runtime_reactors;
    let oldSignal: AbortSignal;
    let calls: string[];
    let release: () => void;
    beforeEach(async () => {
        context = new runtime_reactors();
        calls = [];
        let entered!: () => void;
        const started = new Promise<void>(resolve => { entered = resolve; });
        const blocked = new Promise<void>(resolve => { release = resolve; });
        await context.reactors.register('same', builder => builder.withEventType(Registered), async () => {
            calls.push('old'); entered(); await blocked;
        });
        oldSignal = context.attempts[0].signal;
        context.attempts[0].incoming.send(single('one', [appended('runtime-registered', 'one', 1n), appended('runtime-registered', 'one', 2n)]));
        await started;
        await context.reactors.unregister('same');
        await context.reactors.register('same', builder => builder.on(Registered, () => { calls.push('new'); }));
        release();
        context.attempts[1].incoming.send(single('two', [appended('runtime-registered', 'two', 3n)]));
        await vi.waitFor(() => context.attempts[1].sent.length.should.equal(2));
    });
    afterEach(() => { release(); context.reactors.dispose(); });
    it('should abort locally without waiting for the old callback', () => oldSignal.aborted.should.be.true);
    it('should not start later old deliveries', () => calls.should.deep.equal(['old', 'new']));
    it('should fence a late old acknowledgment from the replacement queue', () => {
        context.attempts[0].sent.length.should.equal(1);
        context.attempts[1].sent[1].Content!.Value1!.LastSuccessfulObservation.should.equal(3n);
    });
});

describe('when a stale stream fails with session loss after same-ID replacement', () => {
    let context: runtime_reactors;
    let reconnect: ReturnType<typeof vi.fn>;
    beforeEach(async () => {
        context = new runtime_reactors();
        reconnect = vi.fn();
        context.lifecycle.onReconnectRequested(reconnect);
        let fail!: () => void;
        const failure = new Promise<void>(resolve => { fail = resolve; });
        context.observe.mockImplementationOnce(() => (async function* () {
            await failure;
            throw new ClientError('observe', Status.FAILED_PRECONDITION, 'Unknown connection');
            yield single('unreachable', []);
        })());
        await context.reactors.register('same', builder => builder.on(Registered, () => {}));
        await context.reactors.unregister('same');
        await context.reactors.register('same', builder => builder.on(Registered, () => {}));
        fail();
        await new Promise(resolve => setImmediate(resolve));
    });
    afterEach(() => context.reactors.dispose());
    it('should not reconnect the current session', () => reconnect.mock.calls.length.should.equal(0));
    it('should leave the replacement observation active', () => context.attempts[0].signal.aborted.should.be.false);
});

describe('when unregistering during the local-start promise', () => {
    let context: runtime_reactors;
    beforeEach(async () => {
        context = new runtime_reactors();
        const pending = context.reactors.register('pending', builder => builder.on(Registered, () => {}));
        await context.reactors.unregister('pending');
        await pending;
        await context.reactors.register('pending', builder => builder.on(Registered, () => {}));
    });
    afterEach(() => context.reactors.dispose());
    it('should release the reservation and not resurrect the first attempt', () => {
        context.attempts[0].signal.aborted.should.be.true;
        context.attempts[1].signal.aborted.should.be.false;
    });
});

for (const stop of ['unregister', 'dispose'] as const) {
    describe(`when ${stop} cancels a scheduled reobserve`, () => {
        let context: runtime_reactors;
        beforeEach(async () => {
            vi.useFakeTimers();
            context = new runtime_reactors();
            await context.reactors.register('runtime', builder => builder.on(Registered, () => {}));
            context.attempts[0].incoming.complete();
            await vi.advanceTimersByTimeAsync(0);
            if (stop === 'unregister') await context.reactors.unregister('runtime');
            else context.reactors.dispose();
            await vi.advanceTimersByTimeAsync(100);
        });
        afterEach(() => { context.reactors.dispose(); vi.useRealTimers(); });
        it('should not reopen the stream', () => context.observe.mock.calls.length.should.equal(1));
    });
}

describe('when a runtime stream ends normally', () => {
    let context: runtime_reactors;
    beforeEach(async () => {
        vi.useFakeTimers();
        context = new runtime_reactors();
        await context.reactors.register('runtime', builder => builder.on(Registered, () => {}));
        context.attempts[0].incoming.complete();
        await vi.advanceTimersByTimeAsync(10);
    });
    afterEach(() => { context.reactors.dispose(); vi.useRealTimers(); });
    it('should reobserve with a fresh attempt signal', () => {
        context.observe.mock.calls.length.should.equal(2);
        context.attempts[0].signal.aborted.should.be.true;
        context.attempts[1].signal.aborted.should.be.false;
    });
});
