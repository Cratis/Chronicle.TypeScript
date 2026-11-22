// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { afterEach, beforeEach, chai, describe, it, vi } from 'vitest';
import { handles } from '../../events/handles.js';
import { observes } from '../../observation/index.js';
import { reactor } from '../reactor.js';
import { ReactorPageDispatcher } from '../ReactorPageDispatcher.js';
import { Registered, Other, runtime_reactors } from './given/runtime_reactors.fixture.js';
import { appended, page, single } from './given/observe_reactor_messages.js';

chai.should();

for (const delivery of ['class', 'batch'] as const) {
    describe(`when unregistering and replacing a discovered reactor during ${delivery} delivery`, () => {
        let context: runtime_reactors;
        let calls: string[];
        let release: () => void;

        beforeEach(async () => {
            context = new runtime_reactors();
            calls = [];
            let entered!: () => void;
            const started = new Promise<void>(resolve => { entered = resolve; });
            const blocked = new Promise<void>(resolve => { release = resolve; });
            const first = async (): Promise<void> => { calls.push('old-first'); entered(); await blocked; };
            @reactor('replace-class')
            class ClassReactor { @handles(Registered) async notify() { await first(); } }
            @reactor('replace-class')
            class BatchReactor {
                @observes(Registered) async firstBatch() { await first(); }
                @observes(Other) secondBatch() { calls.push('old-second'); }
            }
            context.artifacts.push(delivery === 'class' ? ClassReactor : BatchReactor);
            const dispatch = vi.spyOn(ReactorPageDispatcher.prototype, 'dispatch');
            await context.reactors.register();
            context.attempts[0].incoming.send(page(20n, {
                one: [appended('runtime-registered', 'one', 1n), appended('runtime-registered', 'one', 2n), appended('runtime-other', 'one', 3n)],
                two: [appended('runtime-registered', 'two', 4n), appended('runtime-other', 'two', 5n)]
            }));
            await started;
            const oldDelivery = dispatch.mock.results[0].value;
            await context.reactors.unregister('replace-class');
            await context.reactors.register('replace-class', builder => builder.on(Registered, () => { calls.push('replacement'); }));
            release();
            await oldDelivery;
            context.attempts[1].incoming.send(single('new', [appended('runtime-registered', 'new', 6n)]));
            await vi.waitFor(() => context.attempts[1].sent.length.should.equal(2));
        });
        afterEach(() => { release(); context.reactors.dispose(); vi.restoreAllMocks(); });

        it('should not invoke later handlers from the canceled delivery', () => calls.should.deep.equal(['old-first', 'replacement']));
        it('should stop the old observation without stopping its replacement', () => {
            context.attempts[0].signal.aborted.should.be.true;
            context.attempts[1].signal.aborted.should.be.false;
        });
        it('should fence the canceled delivery acknowledgment from the replacement stream', () => {
            context.attempts[0].sent.length.should.equal(1);
            context.attempts[1].sent[1].Content!.Value1!.LastSuccessfulObservation.should.equal(6n);
        });
    });
}
