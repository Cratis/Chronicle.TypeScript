// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { afterEach, beforeEach, chai, describe, it, vi } from 'vitest';
import { handles } from '../../events/handles.js';
import { reactor } from '../reactor.js';
import { Registered, runtime_reactors } from './given/runtime_reactors.fixture.js';

chai.should();

for (const failure of ['constructor', 'instance validation'] as const) {
    describe(`when a class reactor fails ${failure} on reobserve`, () => {
        let context: runtime_reactors;
        let starts: number;
        let logged: ReturnType<typeof vi.spyOn>;

        beforeEach(async () => {
            vi.useFakeTimers();
            context = new runtime_reactors();
            starts = 0;
            @reactor('retry-start')
            class Retried {
                constructor() {
                    starts++;
                    if (starts === 1) return;
                    if (failure === 'constructor') throw new Error('retry constructor failed');
                    Object.defineProperty(this, 'notify', { value: () => {} });
                }
                @handles(Registered) notify() {}
            }
            @reactor('healthy-retry')
            class Healthy { registered() {} }
            context.artifacts.push(Retried, Healthy);
            logged = vi.spyOn(context.reactors['_logger'], 'error');
            await context.reactors.register();
            context.attempts[0].incoming.complete();
            await vi.advanceTimersByTimeAsync(5);
        });
        afterEach(() => { context.reactors.dispose(); vi.restoreAllMocks(); vi.useRealTimers(); });

        it('should contain timer-start failure without opening a faulty stream', () => {
            starts.should.equal(2);
            context.observe.mock.calls.length.should.equal(2);
            context.attempts[1].signal.aborted.should.be.false;
        });
        it('should log against the failed attempt', () => {
            logged.mock.calls.length.should.equal(1);
            logged.mock.calls[0][1].reactorId.should.equal('retry-start');
        });
        it('should back off again rather than throw from the retry timer', async () => {
            await vi.advanceTimersByTimeAsync(9);
            starts.should.equal(2);
            await vi.advanceTimersByTimeAsync(1);
            starts.should.equal(3);
            logged.mock.calls.length.should.equal(2);
            context.observe.mock.calls.length.should.equal(2);
        });
        it('should cancel the failed retry when the identity is unregistered and replaced', async () => {
            await context.reactors.unregister('retry-start');
            await context.reactors.register('retry-start', builder => builder.on(Registered, () => {}));
            await vi.advanceTimersByTimeAsync(100);
            starts.should.equal(2);
            context.observe.mock.calls.length.should.equal(3);
            context.attempts[2].signal.aborted.should.be.false;
        });
    });
}
