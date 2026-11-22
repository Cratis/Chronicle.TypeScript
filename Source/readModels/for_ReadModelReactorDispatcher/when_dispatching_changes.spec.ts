// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { chai, describe, it, vi } from 'vitest';
import { eventType } from '../../events/eventTypeDecorator.js';
import { ReadModelReactorDispatcher } from '../ReadModelReactorDispatcher.js';
import { ReadModelChangeType } from '../ReadModelChangeType.js';
import { readModelReactor } from '../readModelReactor.js';
import type { ReadModelReactorActivator } from '../ReadModelReactorActivator.js';
import { Model, change, store, deferred } from '../for_ReadModelReactors/given/reactorFixture.fixture.js';

chai.should();
@eventType('read-model-reactor-effect')
class Effect {}
const signal = () => new AbortController().signal;
async function failure(promise: Promise<unknown>): Promise<Error> {
    try { await promise; } catch (error) { return error as Error; }
    throw new Error('Expected failure');
}

describe('when dispatching typed read-model changes', () => {
    it('should select only the matching handler and pass the original model and full changeset', async () => {
        const calls: unknown[][] = [];
        @readModelReactor(Model, 'dispatch-types')
        class Reactor {
            added(...args: unknown[]) { calls.push(['added', ...args]); }
            async modified(...args: unknown[]) { calls.push(['modified', ...args]); }
            removed(...args: unknown[]) { calls.push(['removed', ...args]); }
        }
        const fixture = store();
        const dispatcher = new ReadModelReactorDispatcher(Reactor, fixture.value, () => fixture.eventLog);
        for (const type of [ReadModelChangeType.Added, ReadModelChangeType.Modified, ReadModelChangeType.Removed]) {
            const changeset = change(type);
            await dispatcher.dispatch(changeset, signal());
            calls.at(-1)![1].should.equal(changeset.readModel);
            calls.at(-1)![2].should.equal(changeset);
            changeset.changeContext!.sequenceNumber.should.equal(9007199254740995n);
            changeset.changeContext!.occurred!.should.be.instanceOf(Date);
        }
        calls.map(call => call[0]).should.deep.equal(['added', 'modified', 'removed']);
    });
    it('should use only modified or removed for changesets without changeType', async () => {
        const calls: string[] = [];
        @readModelReactor(Model, 'fallback-types')
        class Reactor {
            added() { calls.push('added'); }
            modified() { calls.push('modified'); }
            removed() { calls.push('removed'); }
        }
        const fixture = store();
        const dispatcher = new ReadModelReactorDispatcher(Reactor, fixture.value, () => fixture.eventLog);
        await dispatcher.dispatch({ ...change(), changeContext: undefined }, signal());
        await dispatcher.dispatch({ ...change(), removed: true }, signal());
        calls.should.deep.equal(['modified', 'removed']);
    });
    it('should skip activation for missing handlers and aborted changes', async () => {
        @readModelReactor(Model, 'missing-handler')
        class Reactor { added() {} }
        const fixture = store();
        const activate = vi.fn();
        const dispatcher = new ReadModelReactorDispatcher(Reactor, fixture.value, () => fixture.eventLog, activate);
        await dispatcher.dispatch(change(ReadModelChangeType.Modified), signal());
        await dispatcher.dispatch(change(ReadModelChangeType.Added), AbortSignal.abort());
        activate.mock.calls.should.have.lengthOf(0);
    });
});

describe('when leasing dependency-aware read-model reactors', () => {
    for (const failingStage of ['none', 'handler', 'run', 'effect', 'complete', 'dispose', 'activate']) {
        it(`should release exactly once and preserve errors from ${failingStage}`, async () => {
            const order: string[] = [];
            @readModelReactor(Model, `lease-${failingStage}`)
            class Reactor {
                constructor(private readonly dependency: string) {}
                modified(model: Model) {
                    order.push(this.dependency, model.name);
                    if (failingStage === 'handler') throw new Error('handler failed');
                    return { eventSourceId: 'explicit-source', event: new Effect() };
                }
            }
            const fixture = store();
            const logger = { debug() {}, info() {}, warn() {}, error() {} };
            const activator: ReadModelReactorActivator = async (_type, context) => {
                context.readModel.should.equal(Model);
                context.changeset.readModel.should.be.instanceOf(Model);
                context.handlerName.should.equal('modified');
                if (failingStage === 'activate') throw new Error('activate failed');
                return {
                    instance: new Reactor('dependency') as never,
                    async run(callback) {
                        order.push('run');
                        if (failingStage === 'run') throw new Error('run failed');
                        const result = await callback();
                        order.push('run-exit');
                        return result;
                    },
                    complete() { order.push('complete'); if (failingStage === 'complete') throw new Error('complete failed'); },
                    dispose() { order.push('dispose'); if (failingStage === 'dispose') throw new Error('dispose failed'); }
                };
            };
            if (failingStage === 'effect') fixture.appendMany.mockRejectedValue(new Error('effect failed'));
            const dispatcher = new ReadModelReactorDispatcher(Reactor, fixture.value, () => fixture.eventLog, activator, undefined, logger);
            const result = dispatcher.dispatch(change(), signal());
            if (['none', 'dispose'].includes(failingStage)) await result;
            else (await failure(result)).message.should.contain(failingStage);
            order.filter(stage => stage === 'complete').should.have.lengthOf(failingStage === 'activate' ? 0 : 1);
            order.filter(stage => stage === 'dispose').should.have.lengthOf(failingStage === 'activate' ? 0 : 1);
            if (failingStage === 'none') order.should.deep.equal(['run', 'dependency', 'typed', 'run-exit', 'complete', 'dispose']);
        });
    }
    it('should suppress returned effects after cooperative shutdown and still release the lease', async () => {
        const entered = deferred();
        const release = deferred();
        const cancellation = new AbortController();
        @readModelReactor(Model, 'shutdown-effect')
        class Reactor { async modified() { entered.resolve(); await release.promise; return { eventSourceId: 'source', event: new Effect() }; } }
        const fixture = store();
        const dispose = vi.fn();
        const dispatcher = new ReadModelReactorDispatcher(Reactor, fixture.value, () => fixture.eventLog,
            async type => ({ instance: new type(), dispose }));
        const pending = dispatcher.dispatch(change(), cancellation.signal);
        await entered.promise;
        cancellation.abort();
        release.resolve();
        await pending;
        fixture.appendMany.mock.calls.should.have.lengthOf(0);
        dispose.mock.calls.should.have.lengthOf(1);
    });
});

describe('when routing read-model reactor effects', () => {
    it('should use the changeset namespace and preserve every explicit event route in one append', async () => {
        const wrappers = [{ eventSourceId: 'not-the-model-key', event: new Effect(), eventStreamType: 'stream', eventStreamId: 'id', eventSourceType: 'source' },
            { eventSourceId: 'second', event: new Effect() }];
        @readModelReactor(Model, 'explicit-effects')
        class Reactor { modified() { return wrappers; } }
        const fixture = store();
        const eventLog = vi.fn(() => fixture.eventLog);
        await new ReadModelReactorDispatcher(Reactor, fixture.value, eventLog).dispatch(change(), signal());
        eventLog.mock.calls[0].should.deep.equal(['tenant-change']);
        fixture.appendMany.mock.calls.should.have.lengthOf(1);
        fixture.appendMany.mock.calls[0].should.deep.equal([wrappers]);
    });
    it('should reject a mixed bare-event return before appending any effect', async () => {
        @readModelReactor(Model, 'bare-effects')
        class Reactor { modified() { return [{ eventSourceId: 'source', event: new Effect() }, new Effect()]; } }
        const fixture = store();
        const error = await failure(new ReadModelReactorDispatcher(Reactor, fixture.value, () => fixture.eventLog).dispatch(change(), signal()));
        error.message.should.contain('require EventForEventSourceId');
        fixture.appendMany.mock.calls.should.have.lengthOf(0);
    });
    it('should let a true result hook handle bare events without appending', async () => {
        @readModelReactor(Model, 'hook-effects')
        class Reactor { modified() { return new Effect(); } }
        const fixture = store();
        const hook = vi.fn(async () => true);
        await new ReadModelReactorDispatcher(Reactor, fixture.value, () => fixture.eventLog, undefined, hook).dispatch(change(), signal());
        hook.mock.calls.should.have.lengthOf(1);
        fixture.appendMany.mock.calls.should.have.lengthOf(0);
    });
    it('should ignore unsupported results and turn unsuccessful append results into failures', async () => {
        @readModelReactor(Model, 'append-failure')
        class Reactor { modified() { return { eventSourceId: 'source', event: new Effect() }; } }
        const fixture = store();
        fixture.appendMany.mockResolvedValue([{ isSuccess: false, errors: [{ message: 'rejected' }], constraintViolations: [] }] as never);
        const error = await failure(new ReadModelReactorDispatcher(Reactor, fixture.value, () => fixture.eventLog,
            undefined, async () => false).dispatch(change(), signal()));
        error.message.should.contain('rejected');
        @readModelReactor(Model, 'unsupported-effects')
        class Unsupported { modified() { return { arbitrary: true }; } }
        fixture.appendMany.mockClear();
        await new ReadModelReactorDispatcher(Unsupported, fixture.value, () => fixture.eventLog).dispatch(change(), signal());
        fixture.appendMany.mock.calls.should.have.lengthOf(0);
    });
});
