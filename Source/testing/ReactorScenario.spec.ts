// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { field } from '@cratis/fundamentals';
import { ArtifactCompletionFailed } from '../artifacts/ArtifactCompletionFailed.js';
import { ArtifactDelivery } from '../artifacts/ArtifactDelivery.js';
import { eventType } from '../events/eventTypeDecorator.js';
import type { EventContext } from '../events/EventContext.js';
import { reactor } from '../reactors/reactor.js';
import type { ReactorServices } from '../reactors/ReactorServices.js';
import { chai, describe, it } from 'vitest';
import fixture from './fixtures/builders.json' with { type: 'json' };
import { ReactorScenario } from './ReactorScenario.js';
import { UnsupportedReactorOperation } from './UnsupportedReactorOperation.js';
import type { ReactorScenarioOptions } from './ReactorScenarioOptions.js';

chai.should();

@eventType('OracleEventRecorded')
class Registered {
    @field(String) name: string;
    @field(Boolean) active: boolean;
    constructor(name: string, active = true) { this.name = name; this.active = active; }
}

@eventType('AlternateRecorded')
class Skipped {
    @field(String) label: string;
    constructor(label: string) { this.label = label; }
}

const calls: { event: Registered; context: EventContext; services: ReactorServices }[] = [];
@reactor('scenario-reactor')
class ScenarioReactor {
    registered(event: Registered, context: EventContext, services: ReactorServices) {
        calls.push({ event, context, services });
        return { eventSourceId: 'other', event: new Registered(event.name, false), eventStreamType: 'All', eventStreamId: 'Default' };
    }
}

const options: ReactorScenarioOptions = { artifacts: { eventTypes: [Registered, Skipped] }, constraints: 'disabled',
    clock: () => new Date('2025-01-02T03:04:05.000Z'), correlationId: () => '11111111-2222-3333-4444-555555555555' };

describe('ReactorScenario live delivery', () => {
    it('uses fixture-backed history contexts and records returned events without appending them', async () => {
        calls.length = 0;
        const activations: EventContext[] = [];
        const invocations: EventContext[] = [];
        const steps: string[] = [];
        const scenario = new ReactorScenario(ScenarioReactor, { ...options, artifactActivator: (type, context) => {
            if (context.delivery === ArtifactDelivery.Events) activations.push(context.eventContext);
            return { instance: new type(), run: async (callback, invocation) => {
                if (invocation?.delivery === ArtifactDelivery.Events) invocations.push(invocation.eventContext);
                steps.push('enter'); try { return await callback(); } finally { steps.push('exit'); }
            }, complete: () => { steps.push('complete'); }, dispose: () => { steps.push('dispose'); } };
        } });
        await scenario.given.forEventSource('A').events(new Skipped('first'), new Registered('seed'));
        await scenario.when.forEventSource('A').events(new Registered('act'), new Skipped('last'));
        calls.map(call => call.event.name).should.deep.equal(['seed', 'act']);
        calls[0].event.should.not.be.instanceOf(Registered); // Handler receives serialized plain JSON.
        calls.map(call => call.context.sequenceNumber).should.deep.equal([1n, 2n]);
        calls.map(call => call.context.observationState).should.deep.equal([1, 1]);
        fixture.expected.history.map(entry => BigInt(entry.sequence)).should.deep.equal([0n, 1n, 2n, 3n]);
        fixture.expected.history.every(entry => entry.observationState === 1).should.be.true;
        activations.map(context => context.sequenceNumber).should.deep.equal([1n, 2n]);
        invocations.map(context => context.sequenceNumber).should.deep.equal([1n, 2n]);
        calls.every(call => call.services.eventStore.readModels === call.services.readModels).should.be.true;
        steps.should.deep.equal(['enter', 'exit', 'complete', 'dispose', 'enter', 'exit', 'complete', 'dispose']);
        scenario.results.map(result => [result.handled.length, result.skipped.length, result.completed]).should.deep.equal([[1, 1, true], [1, 1, true]]);
        scenario.produced.length.should.equal(2);
        scenario.shouldHaveProduced(Registered, event => event.name === 'act');
        scenario.shouldNotHaveProduced(Skipped);
        scenario.sideEffects.map(effect => [effect.kind, effect.target.eventSourceId, effect.handler, effect.deliveryIndex])
            .should.deep.equal([['event', 'other', 'registered', 0], ['event', 'other', 'registered', 1]]);
        scenario.then.sideEffects.should.deep.equal(scenario.sideEffects);
        (typeof scenario.then).should.equal('object');
    });

    it('reuses a default instance across deliveries, as the production runtime does', async () => {
        const instances: object[] = [];
        @reactor('default-instance-reactor')
        class Reused {
            constructor() { instances.push(this); }
            registered() {}
        }
        const scenario = new ReactorScenario(Reused, options);
        await scenario.given.forEventSource('A').events(new Registered('one'));
        await scenario.when.forEventSource('B').events(new Registered('two'));
        instances.length.should.equal(1);
    });

    it('keeps handler and completion failures, stops the batch, and disposes after completion', async () => {
        const steps: string[] = [];
        @reactor('throwing-reactor')
        class Failing {
            registered() { steps.push('handler'); throw new Error('processing failed'); }
        }
        const scenario = new ReactorScenario(Failing, { ...options, artifactActivator: type => ({ instance: new type(),
            complete: () => { steps.push('complete'); throw new Error('completion failed'); },
            dispose: () => { steps.push('dispose'); } }) });
        try {
            await scenario.when.forEventSource('A').events(new Registered('one'), new Registered('two'));
            throw new Error('expected rejection');
        } catch (error) {
            (error instanceof ArtifactCompletionFailed).should.be.true;
            String((error as ArtifactCompletionFailed).processingError).should.contain('processing failed');
            String((error as ArtifactCompletionFailed).completionError).should.contain('completion failed');
        }
        steps.should.deep.equal(['handler', 'complete', 'dispose']);
        scenario.results[0].completed.should.be.false;
        scenario.results[0].handled.length.should.equal(0);
    });

    it('awaits side-effect handling within run and propagates declined or thrown results', async () => {
        const steps: string[] = [];
        const scenario = new ReactorScenario(ScenarioReactor, { ...options,
            resultHandler: async () => { steps.push('hook'); throw new Error('hook failed'); },
            artifactActivator: type => ({ instance: new type(), run: async callback => {
                steps.push('enter'); try { return await callback(); } finally { steps.push('exit'); }
            }, complete: () => { steps.push('complete'); } }) });
        await scenario.when.forEventSource('A').events(new Registered('one')).then(() => { throw new Error('expected rejection'); }, error => {
            String(error).should.contain('hook failed');
        });
        steps.should.deep.equal(['enter', 'hook', 'exit', 'complete']);
        scenario.produced.length.should.equal(0);
    });

    it('rejects overlapping deliveries across asynchronous activations', async () => {
        let release!: () => void;
        const pending = new Promise<void>(resolve => { release = resolve; });
        const scenario = new ReactorScenario(ScenarioReactor, { ...options, artifactActivator: async type => {
            await pending; return { instance: new type() };
        } });
        const first = scenario.when.forEventSource('A').events(new Registered('one'));
        await Promise.resolve();
        await scenario.when.forEventSource('B').events(new Registered('two')).then(() => {
            throw new Error('expected rejection');
        }, error => { (error instanceof UnsupportedReactorOperation).should.be.true; });
        release();
        await first;
        scenario.results.length.should.equal(1);
    });
});
