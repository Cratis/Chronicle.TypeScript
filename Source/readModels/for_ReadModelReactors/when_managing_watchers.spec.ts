// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { chai, describe, it, vi } from 'vitest';
import { ReadModelReactors } from '../ReadModelReactors.js';
import { readModelReactor } from '../readModelReactor.js';
import { refuseClientHostedObservers } from '../../artifacts/refuseClientHostedObservers.js';
import { ClientObserversRequireKeepAlive } from '../../connection/ClientObserversRequireKeepAlive.js';
import { ReadModelChangeType } from '../ReadModelChangeType.js';
import { Model, Watcher, artifacts, change, store, deferred } from './given/reactorFixture.fixture.js';

chai.should();
const logger = { debug() {}, info() {}, warn() {}, error: vi.fn() };
@readModelReactor(Model, 'lifecycle-reactor')
class Reactor { modified() {} }
async function failure(promise: Promise<unknown>): Promise<Error> {
    try { await promise; } catch (error) { return error as Error; }
    throw new Error('Expected failure');
}

describe('when managing read-model reactor watchers', () => {
    it('should await acknowledgments and reuse watchers across repeated registration', async () => {
        const watcher = new Watcher();
        const fixture = store([watcher]);
        const runtime = new ReadModelReactors(artifacts([Reactor, Reactor]), fixture.value, () => fixture.eventLog);
        const pending = runtime.start();
        let ready = false;
        void pending.then(() => { ready = true; });
        await Promise.resolve();
        ready.should.be.false;
        watcher.acknowledge();
        await pending;
        await runtime.start();
        fixture.createWatcher.mock.calls.should.have.lengthOf(1);
        fixture.createWatcher.mock.calls[0][1].resume.should.be.true;
        runtime.stop();
        runtime.stop();
        await runtime.completion;
    });
    it('should activate and process serially after a previous change fails, even if onError throws', async () => {
        const watcher = new Watcher();
        const fixture = store([watcher]);
        const received = deferred();
        const calls: string[] = [];
        @readModelReactor(Model, 'continuing-reactor')
        class Continuing {
            async modified(model: Model) {
                calls.push(model.name);
                if (model.name === 'first') throw new Error('first failed');
                received.resolve();
            }
        }
        const onError = vi.fn(() => { throw new Error('reporting failed'); });
        const runtime = new ReadModelReactors(artifacts([Continuing]), fixture.value, () => fixture.eventLog,
            undefined, undefined, onError, logger);
        watcher.acknowledge();
        await runtime.start();
        watcher.push({ ...change(), readModel: Object.assign(new Model(), { name: 'first' }) });
        watcher.push({ ...change(), readModel: Object.assign(new Model(), { name: 'second' }) });
        await received.promise;
        runtime.stop();
        await runtime.completion;
        calls.should.deep.equal(['first', 'second']);
        onError.mock.calls.should.have.lengthOf(1);
        onError.mock.calls[0][0].message.should.equal('first failed');
    });
    it('should stop partially started watchers and reject both readiness and completion', async () => {
        const watcher = new Watcher();
        const fixture = store([watcher]);
        @readModelReactor(Model, 'second-startup-reactor')
        class Second { added() {} }
        fixture.createWatcher.mockImplementationOnce(() => watcher).mockImplementationOnce(() => { throw new Error('startup failed'); });
        const runtime = new ReadModelReactors(artifacts([Reactor, Second]), fixture.value, () => fixture.eventLog, undefined, undefined, undefined, logger);
        (await failure(runtime.start())).message.should.equal('startup failed');
        (await failure(runtime.completion)).message.should.equal('startup failed');
        watcher.dispose.mock.calls.should.have.lengthOf(1);
    });
    it('should propagate subscription failure and stop every watcher', async () => {
        const watcher = new Watcher();
        const fixture = store([watcher]);
        const runtime = new ReadModelReactors(artifacts([Reactor]), fixture.value, () => fixture.eventLog, undefined, undefined, undefined, logger);
        const pending = runtime.start();
        watcher.rejectSubscription(new Error('subscription failed'));
        (await failure(pending)).message.should.equal('subscription failed');
        (await failure(runtime.completion)).message.should.equal('subscription failed');
        watcher.dispose.mock.calls.should.have.lengthOf(1);
    });
    it('should reject completion for a terminal watcher failure', async () => {
        const watcher = new Watcher();
        const fixture = store([watcher]);
        const runtime = new ReadModelReactors(artifacts([Reactor]), fixture.value, () => fixture.eventLog, undefined, undefined, undefined, logger);
        watcher.acknowledge();
        await runtime.start();
        watcher.fail(new Error('watch failed'));
        (await failure(runtime.completion)).message.should.equal('watch failed');
    });
    it('should drain an in-flight lease but not activate buffered changes after stop', async () => {
        const entered = deferred();
        const release = deferred();
        const watcher = new Watcher();
        const fixture = store([watcher]);
        @readModelReactor(Model, 'draining-reactor')
        class Draining { async modified() { entered.resolve(); await release.promise; } }
        const dispose = vi.fn();
        const activate = vi.fn(async (type: typeof Draining) => ({ instance: new type(), dispose }));
        const runtime = new ReadModelReactors(artifacts([Draining]), fixture.value, () => fixture.eventLog, activate);
        watcher.acknowledge();
        await runtime.start();
        watcher.push(change());
        watcher.push(change(ReadModelChangeType.Added));
        await entered.promise;
        runtime.stop();
        let drained = false;
        void runtime.completion.then(() => { drained = true; });
        await Promise.resolve();
        drained.should.be.false;
        release.resolve();
        await runtime.completion;
        activate.mock.calls.should.have.lengthOf(1);
        dispose.mock.calls.should.have.lengthOf(1);
    });
    it('should accept an old explicit provider without the optional collection', async () => {
        const provider = artifacts();
        delete (provider as { readModelReactors?: unknown }).readModelReactors;
        const fixture = store();
        const runtime = new ReadModelReactors(provider, fixture.value, () => fixture.eventLog);
        await runtime.start();
        runtime.stop();
        await runtime.completion;
        fixture.createWatcher.mock.calls.should.have.lengthOf(0);
    });
    it('should reject an unresolved custom read model before watching', async () => {
        const fixture = store();
        const runtime = new ReadModelReactors({ ...artifacts([Reactor]), readModels: [] }, fixture.value, () => fixture.eventLog,
            undefined, undefined, undefined, logger);
        (await failure(runtime.start())).message.should.contain('registered root read model');
        await failure(runtime.completion);
        fixture.createWatcher.mock.calls.should.have.lengthOf(0);
    });
    it('should refuse short-lived clients without extending the existing observer-kind union', () => {
        (() => refuseClientHostedObservers(artifacts([Reactor]))).should.throw(ClientObserversRequireKeepAlive);
        (() => refuseClientHostedObservers(artifacts())).should.not.throw();
    });
});
