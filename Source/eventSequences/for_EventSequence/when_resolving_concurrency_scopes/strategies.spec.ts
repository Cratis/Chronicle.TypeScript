// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { chai, describe, it, vi } from 'vitest';
import { ConcurrencyScopeStrategies, EventSequenceNumber, type ConcurrencyScopeStrategyContext } from '../../index.js';
import { create, Deposited, routing } from './given.fixture.js';

const should = chai.should();

for (const batch of [false, true]) {
    const append = async (sequence: Awaited<ReturnType<typeof create>>['sequence']) => batch
        ? sequence.appendMany('a', [new Deposited()], routing)
        : sequence.append('a', new Deposited(), routing);

    describe(`when resolving ${batch ? 'batch' : 'single'} append concurrency scopes`, () => {
        it('should preserve the default scoped tail and scope when optimistic is selected', async () => {
            const original = await create();
            const optimistic = await create(ConcurrencyScopeStrategies.optimistic);
            await append(original.sequence);
            await append(optimistic.sequence);
            optimistic.tailSequenceNumber.mock.calls.should.deep.equal(original.tailSequenceNumber.mock.calls);
            const tail = optimistic.tailSequenceNumber.mock.calls[0][0];
            tail.EventSourceId.should.equal('a');
            tail.EventStreamType.should.equal('Transactions');
            tail.EventStreamId.should.equal('tx-1');
            tail.EventSourceType.should.equal('');
            if (batch) {
                optimistic.appendManyForEventSources.mock.calls[0][0].ConcurrencyScopes.should.deep.equal(
                    original.appendManyForEventSources.mock.calls[0][0].ConcurrencyScopes);
            } else {
                optimistic.append.mock.calls[0][0].ConcurrencyScope.should.deep.equal(original.append.mock.calls[0][0].ConcurrencyScope);
            }
        });

        it('should preserve the first append guard on an empty scoped stream', async () => {
            const c = await create(ConcurrencyScopeStrategies.optimistic, EventSequenceNumber.unset.value);
            await append(c.sequence);
            const scope = batch ? c.appendManyForEventSources.mock.calls[0][0].ConcurrencyScopes[0].Scope
                : c.append.mock.calls[0][0].ConcurrencyScope;
            scope.ExpectsNoMatchingEvent.should.equal(true);
            scope.SequenceNumber.should.equal(EventSequenceNumber.unset.value);
            scope.EventStreamId.should.equal('tx-1');
        });

        for (const strategy of [ConcurrencyScopeStrategies.none, () => undefined, async () => undefined]) {
            it('should send no check and never read the tail when the strategy returns none', async () => {
                const c = await create(strategy);
                await append(c.sequence);
                c.tailSequenceNumber.mock.calls.should.have.length(0);
                const scope = batch ? c.appendManyForEventSources.mock.calls[0][0].ConcurrencyScopes[0].Scope
                    : c.append.mock.calls[0][0].ConcurrencyScope;
                // Preserve the existing wire representation of an absent scope (the no-check sentinel).
                scope.SequenceNumber.should.equal(EventSequenceNumber.unset.value);
                scope.ExpectsNoMatchingEvent.should.equal(false);
                scope.EventSourceId.should.equal(false);
            });
        }

        for (const asynchronous of [false, true]) {
            it(`should use a custom ${asynchronous ? 'async' : 'sync'} scope without default tail reads`, async () => {
                const scope = { sequenceNumber: 3n, eventSourceId: true };
                const strategy = vi.fn((context: ConcurrencyScopeStrategyContext) => {
                    context.eventSourceId.should.equal('a');
                    context.events.should.have.length(1);
                    context.events[0].event.should.be.instanceOf(Deposited);
                    context.options.should.equal(routing);
                    return asynchronous ? Promise.resolve(scope) : scope;
                });
                const c = await create(strategy);
                await append(c.sequence);
                strategy.mock.calls.should.have.length(1);
                c.tailSequenceNumber.mock.calls.should.have.length(0);
                const sent = batch ? c.appendManyForEventSources.mock.calls[0][0].ConcurrencyScopes[0].Scope
                    : c.append.mock.calls[0][0].ConcurrencyScope;
                sent.SequenceNumber.should.equal(3n);
                sent.EventSourceId.should.equal(true);
            });

            it(`should fail closed when a custom strategy ${asynchronous ? 'rejects' : 'throws'}`, async () => {
                const failure = new Error('scope unavailable');
                const c = await create(() => {
                    if (asynchronous) return Promise.reject(failure);
                    throw failure;
                });
                let caught: unknown;
                try { await append(c.sequence); } catch (error) { caught = error; }
                should.equal(caught, failure);
                c.append.mock.calls.should.have.length(0);
                c.appendManyForEventSources.mock.calls.should.have.length(0);
            });
        }
    });
}

describe('when explicit scopes are supplied', () => {
    it('should bypass a custom strategy for a single append', async () => {
        const strategy = vi.fn(() => { throw new Error('must not run'); });
        const c = await create(strategy);
        await c.sequence.append('a', new Deposited(), { ...routing, concurrencyScope: { sequenceNumber: 4n } });
        strategy.mock.calls.should.have.length(0);
        c.tailSequenceNumber.mock.calls.should.have.length(0);
        c.append.mock.calls[0][0].ConcurrencyScope.SequenceNumber.should.equal(4n);
    });

    for (const strategy of [ConcurrencyScopeStrategies.optimistic, ConcurrencyScopeStrategies.none]) {
        it('should preserve explicit scopes under built-in policies', async () => {
            const c = await create(strategy);
            await c.sequence.append('a', new Deposited(), { ...routing, concurrencyScope: { sequenceNumber: 4n } });
            await c.sequence.appendMany('a', [new Deposited()], { ...routing, concurrencyScope: { sequenceNumber: 4n } });
            c.tailSequenceNumber.mock.calls.should.have.length(0);
            c.append.mock.calls[0][0].ConcurrencyScope.SequenceNumber.should.equal(4n);
            c.appendManyForEventSources.mock.calls[0][0].ConcurrencyScopes[0].Scope.SequenceNumber.should.equal(4n);
        });
    }

    it('should resolve only unscoped ids in a mixed batch and group their events', async () => {
        const strategy = vi.fn(async (context: ConcurrencyScopeStrategyContext) => {
            context.events.should.have.length(2);
            const tail = await context.readTail(context.eventSourceId);
            return { sequenceNumber: tail.value, eventSourceId: true };
        });
        const c = await create(strategy);
        await c.sequence.appendMany([
            { eventSourceId: 'explicit', event: new Deposited() },
            { eventSourceId: 'derived', event: new Deposited() },
            { eventSourceId: 'derived', event: new Deposited() }
        ], { ...routing, concurrencyScopes: { explicit: { sequenceNumber: 2n } } });
        strategy.mock.calls.should.have.length(1);
        strategy.mock.calls[0][0].eventSourceId.should.equal('derived');
        const scopes = c.appendManyForEventSources.mock.calls[0][0].ConcurrencyScopes;
        scopes.map(entry => [entry.EventSourceId, entry.Scope.SequenceNumber]).should.deep.equal([['explicit', 2n], ['derived', 7n]]);
        c.tailSequenceNumber.mock.calls.should.have.length(1);
    });

    it('should bypass the custom strategy when every id has an explicit shared scope', async () => {
        const strategy = vi.fn(() => { throw new Error('must not run'); });
        const c = await create(strategy);
        await c.sequence.appendMany([
            { eventSourceId: 'a', event: new Deposited() },
            { eventSourceId: 'b', event: new Deposited() }
        ], { ...routing, concurrencyScope: { sequenceNumber: 4n } });
        strategy.mock.calls.should.have.length(0);
        c.appendManyForEventSources.mock.calls[0][0].ConcurrencyScopes.map(entry => entry.Scope.SequenceNumber).should.deep.equal([4n, 4n]);
    });

    it('should not append a partly resolved batch when a later strategy call fails', async () => {
        const failure = new Error('second scope unavailable');
        const c = await create(async context => {
            if (context.eventSourceId === 'b') throw failure;
            return { sequenceNumber: 2n };
        });
        let caught: unknown;
        try {
            await c.sequence.appendMany([
                { eventSourceId: 'a', event: new Deposited() },
                { eventSourceId: 'b', event: new Deposited() }
            ]);
        } catch (error) { caught = error; }
        should.equal(caught, failure);
        c.appendManyForEventSources.mock.calls.should.have.length(0);
    });

    it('should retain explicit ids and derive the rest using optimistic routing', async () => {
        const c = await create();
        await c.sequence.appendMany([
            { eventSourceId: 'explicit', event: new Deposited() },
            { eventSourceId: 'derived', event: new Deposited() }
        ], { ...routing, concurrencyScopes: { explicit: { sequenceNumber: 2n } } });
        const scopes = c.appendManyForEventSources.mock.calls[0][0].ConcurrencyScopes;
        scopes.map(entry => [entry.EventSourceId, entry.Scope.SequenceNumber]).should.deep.equal([['explicit', 2n], ['derived', 7n]]);
        c.tailSequenceNumber.mock.calls.should.have.length(1);
        c.tailSequenceNumber.mock.calls[0][0].EventSourceId.should.equal('derived');
    });
});
