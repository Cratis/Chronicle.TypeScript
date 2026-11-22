// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { afterEach, beforeEach, chai, describe, it, vi } from 'vitest';
import { reactor } from '../reactor.js';
import { ReactorId } from '../ReactorId.js';
import { Registered, runtime_reactors } from './given/runtime_reactors.fixture.js';

chai.should();

@reactor('discovered-runtime-test')
class Discovered { registered() {} }
@reactor('discovered-runtime-test')
class Duplicate { registered() {} }

for (const style of ['definition', 'fluent', 'delegate'] as const) {
    describe(`when registering a ${style} reactor`, () => {
        let context: runtime_reactors;
        beforeEach(async () => {
            context = new runtime_reactors();
            if (style === 'definition') await context.reactors.register(context.reactors.define('runtime', builder => builder.on(Registered, () => {})));
            if (style === 'fluent') await context.reactors.register(new ReactorId('runtime'), builder => builder.on(Registered, () => {}));
            if (style === 'delegate') await context.reactors.register('runtime', builder => builder.withEventType(Registered), () => {});
            await vi.waitFor(() => context.attempts[0].sent.length.should.equal(1));
        });
        afterEach(() => context.reactors.dispose());
        it('should resolve at local start without receiving an inbound acknowledgment', () => context.observe.mock.calls.length.should.equal(1));
        it('should use the shared protocol subscription', () => {
            const request = context.attempts[0].sent[0].Content!.Value0!;
            request.EventStore.should.equal('store');
            request.Namespace.should.equal('tenant');
            request.Reactor!.ReactorId.should.equal('runtime');
            request.Reactor!.EventTypes.map(type => type.EventType!.Id).should.deep.equal(['runtime-registered']);
        });
    });
}

describe('when validating duplicate discovery before observation', () => {
    let context: runtime_reactors;
    let failure: unknown;
    beforeEach(async () => {
        context = new runtime_reactors();
        context.artifacts.push(Discovered, Duplicate);
        try { await context.reactors.register(); } catch (error) { failure = error; }
    });
    afterEach(() => context.reactors.dispose());
    it('should reject the duplicated ID', () => (failure as Error).message.should.match(/discovered-runtime-test.*already registered/));
    it('should not partially open the valid part of the batch', () => context.observe.mock.calls.length.should.equal(0));
});

for (const scenario of ['concurrent runtime', 'artifact collision', 'runtime then discovery'] as const) {
    describe(`when rejecting a ${scenario} ID collision`, () => {
        let context: runtime_reactors;
        let failure: unknown;
        beforeEach(async () => {
            context = new runtime_reactors();
            const register = () => context.reactors.register('discovered-runtime-test', builder => builder.on(Registered, () => {}));
            if (scenario === 'artifact collision') context.artifacts.push(Discovered);
            else await register();
            try {
                if (scenario === 'runtime then discovery') {
                    context.artifacts.push(Discovered);
                    await context.reactors.discover();
                } else await register();
            } catch (error) { failure = error; }
        });
        afterEach(() => context.reactors.dispose());
        it('should reject rather than replace the reserved identity', () => (failure as Error).message.should.match(/already registered/));
        it('should not open an extra stream', () => context.observe.mock.calls.length.should.equal(scenario === 'artifact collision' ? 0 : 1));
    });
}

describe('when registering discovered and runtime definitions repeatedly', () => {
    let context: runtime_reactors;
    beforeEach(async () => {
        context = new runtime_reactors();
        context.artifacts.push(Discovered);
        await context.reactors.register('runtime', builder => builder.on(Registered, () => {}));
        await context.reactors.register();
        await context.reactors.register();
    });
    afterEach(() => context.reactors.dispose());
    it('should keep exactly one stream for each identity', () => context.observe.mock.calls.length.should.equal(2));
});

for (const scenario of ['keep-alive disabled', 'disposed'] as const) {
    describe(`when registering with ${scenario}`, () => {
        let context: runtime_reactors;
        let failure: unknown;
        beforeEach(async () => {
            context = new runtime_reactors(scenario === 'keep-alive disabled');
            if (scenario === 'disposed') context.reactors.dispose();
            try { await context.reactors.register('runtime', builder => builder.on(Registered, () => {})); }
            catch (error) { failure = error; }
        });
        afterEach(() => context.reactors.dispose());
        it('should reject without opening a stream', () => {
            (failure instanceof Error).should.be.true;
            context.observe.mock.calls.length.should.equal(0);
        });
    });
}
