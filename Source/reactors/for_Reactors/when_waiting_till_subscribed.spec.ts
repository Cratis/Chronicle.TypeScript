// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { afterEach, beforeEach, chai, describe, it, vi } from 'vitest';
import { ObserverInformation } from '@cratis/chronicle.contracts';
import { Registered, runtime_reactors } from './given/runtime_reactors.fixture.js';

chai.should();

describe('when waiting for a reactor subscription', () => {
    let context: runtime_reactors;
    let completed: boolean;
    beforeEach(async () => {
        vi.useFakeTimers();
        context = new runtime_reactors();
        await context.reactors.register('runtime', builder => builder.on(Registered, () => {}).onEventSequence('custom'));
        context.information.mockResolvedValueOnce(ObserverInformation.fromPartial({ IsSubscribed: false }))
            .mockResolvedValue(ObserverInformation.fromPartial({ IsSubscribed: true }));
        const pending = context.reactors.waitTillSubscribed('runtime', { timeout: 100 });
        await vi.advanceTimersByTimeAsync(50);
        await pending;
        completed = true;
    });
    afterEach(() => { context.reactors.dispose(); vi.useRealTimers(); });
    it('should poll until the observer reports subscribed', () => {
        completed.should.be.true;
        context.information.mock.calls.length.should.equal(2);
    });
    it('should scope readiness to the store namespace ID and sequence', () => {
        const request = (context.information.mock.calls as unknown as [object][])[0][0];
        request.should.deep.equal({ EventStore: 'store', Namespace: 'tenant', ObserverId: 'runtime', EventSequenceId: 'custom' });
    });
});

for (const scenario of ['timeout', 'cancellation', 'disposal', 'query failure'] as const) {
    describe(`when subscription readiness encounters ${scenario}`, () => {
        let context: runtime_reactors;
        let failure: unknown;
        beforeEach(async () => {
            vi.useFakeTimers();
            context = new runtime_reactors();
            const controller = new AbortController();
            if (scenario === 'query failure') context.information.mockRejectedValue(new Error('query denied'));
            const pending = context.reactors.waitTillSubscribed('runtime', { timeout: 100, signal: controller.signal }).catch(error => { failure = error; });
            if (scenario === 'cancellation') controller.abort();
            if (scenario === 'disposal') context.reactors.dispose();
            await vi.advanceTimersByTimeAsync(100);
            await pending;
        });
        afterEach(() => { context.reactors.dispose(); vi.useRealTimers(); });
        it('should settle without claiming readiness', () => (failure instanceof Error).should.be.true);
        it('should not register an observation as a side effect', () => context.observe.mock.calls.length.should.equal(0));
    });
}

describe('when readiness observes an already subscribed observer', () => {
    let context: runtime_reactors;
    beforeEach(async () => {
        context = new runtime_reactors();
        context.information.mockResolvedValue(ObserverInformation.fromPartial({ IsSubscribed: true }));
        await context.reactors.waitTillSubscribed('existing');
    });
    afterEach(() => context.reactors.dispose());
    it('should allow readiness independently of a local registration acknowledgment', () => context.information.mock.calls.length.should.equal(1));
});
