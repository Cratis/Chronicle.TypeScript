// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { chai, describe, it } from 'vitest';
import type { AppendOptions } from '../../../eventSequences/AppendOptions.js';
import { Claim, Effect, createEvents, createReactor, rejection, route, routing } from '../../for_EventScenario/given/routed_scenario.fixture.js';

chai.should();
describe('when delivering routed setup and action events', () => {
    it('should expose the recorded route in handled and triggering contexts', async () => {
        const scenario = createReactor();
        await scenario.given.forEventSource('A', route).events(new Claim('Given'));
        await scenario.when.forEventSource('B', { ...route, streamId: 'East' }).events(new Claim('First'), new Claim('Second'));
        const expected = [route, { ...route, streamId: 'East' }, { ...route, streamId: 'East' }];
        scenario.appendedEvents.map(event => routing(event.context)).should.deep.equal(expected);
        scenario.results.flatMap(result => result.handled.map(routing)).should.deep.equal(expected);
        scenario.sideEffects.map(effect => routing(effect.triggeringContext)).should.deep.equal(expected);
        scenario.sideEffects.map(effect => effect.triggeringContext).should.deep.equal(scenario.appendedEvents.map(event => event.context));
        scenario.sideEffects.map(effect => effect.target.eventStreamId).should.deep.equal(['West', 'East', 'East']);
        scenario.produced.map(effect => (effect as Effect).key).should.deep.equal([
            'Given:Customer/Orders/West', 'First:Customer/Orders/East', 'Second:Customer/Orders/East']);
    });

    it('should enforce scoped constraints before delivering any rejected action batch', async () => {
        const scenario = createReactor();
        await scenario.given.forEventSource('A', route).events(new Claim('Taken'));
        await scenario.when.forEventSource('B', { ...route, streamId: 'East' }).events(new Claim('Taken'));
        const before = scenario.appendedEvents;
        await scenario.when.forEventSource('C', route).events(new Claim('Temporary'), new Claim('Taken')).then(
            () => { throw new Error('Expected constraint rejection'); }, error => (error as Error).message.should.include('ReactorScenario action append failed'));
        scenario.appendedEvents.should.deep.equal(before);
        scenario.produced.should.have.lengthOf(2);
        scenario.results.should.have.lengthOf(2);
        await scenario.when.forEventSource('D', route).events(new Claim('Temporary'));
        scenario.appendedEvents[2].context.sequenceNumber.should.equal(2n);
    });

    it('should roll back rejected routed setup before recording effects or delivery outcomes', async () => {
        const scenario = createReactor();
        await scenario.given.forEventSource('A', route).events(new Claim('Taken'));
        await scenario.given.forEventSource('B', route).events(new Claim('Temporary'), new Claim('Taken')).then(
            () => { throw new Error('Expected failed setup'); }, error => (error as Error).message.should.include('EventScenario given setup failed'));
        scenario.appendedEvents.should.have.lengthOf(1);
        scenario.produced.should.have.lengthOf(1);
        scenario.results.should.have.lengthOf(1);
        await scenario.when.forEventSource('C', route).events(new Claim('Temporary'));
        scenario.appendedEvents[1].context.sequenceNumber.should.equal(1n);
    });

    it('should keep default routing for omitted and empty route options', async () => {
        const scenario = createReactor();
        await scenario.given.forEventSource('A').events(new Claim('Given'));
        await scenario.when.forEventSource('B', { sourceType: '', streamType: '', streamId: '' }).events(new Claim('Action'));
        scenario.results.flatMap(result => result.handled.map(routing)).should.deep.equal(Array(2).fill({ sourceType: 'Default', streamType: 'All', streamId: 'Default' }));
    });
});

describe('when reactor builders receive unsupported routing', () => {
    it('should reject through append validation without delivering or poisoning the next action', async () => {
        const scenario = createReactor();
        const direct = createEvents();
        for (const value of [null, [], { sourceType: 1 }, { streamType: 'a|b' }, { streamId: ' ' }, { arbitrary: true }]) {
            const options = value as AppendOptions;
            const single = await rejection(() => direct.append('A', new Claim('Other'), options));
            (await rejection(() => scenario.given.forEventSource('A', options).events(new Claim('Other')))).message.should.equal(single.message);
            const batch = await rejection(() => direct.appendMany('A', [new Claim('Other')], options));
            (await rejection(() => scenario.when.forEventSource('A', options).events(new Claim('Other')))).message.should.equal(batch.message);
        }
        scenario.appendedEvents.should.have.lengthOf(0);
        scenario.results.should.have.lengthOf(0);
        scenario.sideEffects.should.have.lengthOf(0);
        await scenario.when.forEventSource('A', route).events(new Claim('Accepted'));
        scenario.appendedEvents[0].context.sequenceNumber.should.equal(0n);
        scenario.results[0].completed.should.be.true;
    });
});
