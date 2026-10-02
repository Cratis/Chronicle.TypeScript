// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { chai, describe, it, vi } from 'vitest';
import type { AppendOptions } from '../../../eventSequences/AppendOptions.js';
import { Claim, createEvents, rejection, route, routing } from '../given/routed_scenario.fixture.js';

chai.should();
describe('when seeding with routed builders', () => {
    it('should record each setup route through single append without action results', async () => {
        const scenario = createEvents();
        await scenario.given.forEventSource('A', route).events(new Claim('Alpha'), new Claim('Beta'));
        scenario.appendedEvents.map(event => routing(event.context)).should.deep.equal([route, route]);
        scenario.results.should.have.lengthOf(0);
        (await scenario.append('B', new Claim('Alpha'), route)).isSuccess.should.be.true;
        (await scenario.append('B', new Claim('Beta'), route)).isSuccess.should.be.false;
    });

    it('should roll back routed setup and preserve claims in other scopes', async () => {
        const scenario = createEvents();
        await scenario.given.forEventSource('A', route).events(new Claim('Taken'));
        await scenario.given.forEventSource('A').events(new Claim('DefaultKey'));
        const before = scenario.appendedEvents;
        await scenario.given.forEventSource('B', route).events(new Claim('Temporary'), new Claim('Taken')).then(
            () => { throw new Error('Expected failed setup'); }, error => (error as Error).message.should.include('EventScenario given setup failed'));
        scenario.appendedEvents.should.deep.equal(before);
        scenario.results.should.have.lengthOf(0);
        (await scenario.when.forEventSource('C', route).event(new Claim('Temporary'))).sequenceNumber.value.should.equal(2n);
        (await scenario.when.forEventSource('D').event(new Claim('DefaultKey'))).isSuccess.should.be.false;
    });
});

describe('when acting with routed builders', () => {
    it('should preserve append metadata identically to direct atomic batches', async () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-01-02T03:04:05.000Z'));
        try {
            const scenario = createEvents();
            const direct = createEvents();
            const subject = 'CustomerSubject';
            const correlationId = '11111111-2222-3333-4444-555555555555';
            const occurred = new Date('2025-12-01T12:34:56.000Z');
            const tags = ['Priority', 'Routed'];
            await scenario.when.forEventSource('A', { ...route, subject, correlationId, occurred, tags }).events(new Claim('Alpha'), new Claim('Beta'));
            await direct.appendMany('A', [new Claim('Alpha'), new Claim('Beta')], { ...route, subject, correlationId, occurred, tags });
            scenario.appendedEvents.map(event => event.context).should.deep.equal(direct.appendedEvents.map(event => event.context));
        } finally { vi.useRealTimers(); }
    });

    it('should use the route for single actions and atomic batches', async () => {
        const scenario = createEvents();
        (await scenario.when.forEventSource('A', route).event(new Claim('Alpha'))).isSuccess.should.be.true;
        const results = await scenario.when.forEventSource('B', { ...route, streamId: 'East' }).events(new Claim('Alpha'), new Claim('Beta'));
        results.every(result => result.isSuccess).should.be.true;
        scenario.appendedEvents.map(event => routing(event.context)).should.deep.equal([route,
            { ...route, streamId: 'East' }, { ...route, streamId: 'East' }]);
        scenario.results.should.have.lengthOf(3);
    });

    it('should honor every scoped dimension and reject only the matching route', async () => {
        const scenario = createEvents();
        await scenario.given.forEventSource('A', route).events(new Claim('Taken'));
        for (const dimension of ['sourceType', 'streamType', 'streamId'] as const) {
            (await scenario.when.forEventSource(`B-${dimension}`, { ...route, [dimension]: 'Other' }).event(new Claim('Taken'))).isSuccess.should.be.true;
        }
        const before = scenario.appendedEvents;
        const results = await scenario.when.forEventSource('C', route).events(new Claim('Temporary'), new Claim('Taken'));
        results.every(result => !result.isSuccess).should.be.true;
        scenario.appendedEvents.should.deep.equal(before);
        (await scenario.when.forEventSource('D', route).event(new Claim('Temporary'))).sequenceNumber.value.should.equal(4n);
    });

    it('should retain omitted routing and resolve empty strings to exact defaults', async () => {
        const scenario = createEvents();
        await scenario.given.forEventSource('A').events(new Claim('Given'));
        await scenario.given.forEventSource('B', { sourceType: '', streamType: '', streamId: '' }).events(new Claim('Empty'));
        await scenario.when.forEventSource('C').event(new Claim('Single'));
        await scenario.when.forEventSource('D', {}).events(new Claim('Batch'));
        scenario.appendedEvents.map(event => routing(event.context)).should.deep.equal(Array(4).fill({ sourceType: 'Default', streamType: 'All', streamId: 'Default' }));
        (await scenario.when.forEventSource('E', { streamId: '' }).event(new Claim('Given'))).isSuccess.should.be.false;
    });
});

describe('when routed builders receive unsupported options', () => {
    it('should reject identically to their append path without changing history, results or notifications', async () => {
        const scenario = createEvents();
        await scenario.given.forEventSource('A', route).events(new Claim('Taken'));
        const before = scenario.appendedEvents;
        const notifications = scenario.eventLog.appendOperations[Symbol.asyncIterator]();
        const pending = notifications.next();
        try {
            const invalid: unknown[] = [null, [], { concurrencyScopes: {} }, { arbitrary: true }];
            for (const dimension of ['sourceType', 'streamType', 'streamId'] as const) {
                for (const value of [' ', 'a|b', 'é', '*', 'a:b', 'a\u0000b', 1, null]) invalid.push({ [dimension]: value });
            }
            for (const value of invalid) {
                const options = value as AppendOptions;
                const single = await rejection(() => scenario.append('B', new Claim('Other'), options));
                (await rejection(() => scenario.given.forEventSource('B', options).events(new Claim('Other')))).message.should.equal(single.message);
                (await rejection(() => scenario.when.forEventSource('B', options).event(new Claim('Other')))).message.should.equal(single.message);
                const batch = await rejection(() => scenario.appendMany('B', [new Claim('Other')], options));
                (await rejection(() => scenario.when.forEventSource('B', options).events(new Claim('Other')))).message.should.equal(batch.message);
            }
            const metadata = { tags: [] };
            const single = await rejection(() => scenario.append('B', new Claim('Other'), metadata));
            (await rejection(() => scenario.given.forEventSource('B', metadata).events(new Claim('Other')))).message.should.equal(single.message);
            (await rejection(() => scenario.when.forEventSource('B', metadata).event(new Claim('Other')))).message.should.equal(single.message);
            scenario.appendedEvents.should.deep.equal(before);
            scenario.results.should.have.lengthOf(0);
            (await scenario.eventLog.getNextSequenceNumber()).value.should.equal(1n);
            const rejected = await scenario.when.forEventSource('B', route).event(new Claim('Taken'));
            rejected.isSuccess.should.be.false;
            (await pending).value![0].result.should.equal(rejected);
        } finally { await notifications.return?.(); }
    });
});
