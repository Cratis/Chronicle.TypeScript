// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { field } from '@cratis/fundamentals';
import { ArtifactCompletionFailed } from '../artifacts/ArtifactCompletionFailed.js';
import { ArtifactDelivery } from '../artifacts/ArtifactDelivery.js';
import { DecoratorType } from '../types/DecoratorType.js';
import { TypeDiscoverer } from '../types/TypeDiscoverer.js';
import type { IEventStore } from '../IEventStore.js';
import { eventType } from '../events/eventTypeDecorator.js';
import { filterEventsByTag } from '../events/filterEventsByTagDecorator.js';
import { EventSequenceNumber } from '../eventSequences/EventSequenceNumber.js';
import type { IEventLog } from '../eventSequences/IEventLog.js';
import type { EventContext } from '../events/EventContext.js';
import { reactor } from '../reactors/reactor.js';
import type { ReactorServices } from '../reactors/ReactorServices.js';
import { chai, describe, it, vi } from 'vitest';
import fixture from './fixtures/builders.json' with { type: 'json' };
import { ReactorScenario } from './ReactorScenario.js';
import { UnsupportedReactorOperation } from './UnsupportedReactorOperation.js';
import { UnsupportedEventSequenceOperation } from './UnsupportedEventSequenceOperation.js';
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
    it('rejects an empty reactor event sequence ID before activation', () => {
        let created = false;
        @reactor('empty-sequence-reactor', '')
        class EmptySequence {
            constructor() { created = true; }
            registered() {}
        }
        (() => new ReactorScenario(EmptySequence, options)).should.throw(UnsupportedReactorOperation, 'reactor.eventSequenceId');
        created.should.be.false;
    });

    it('preserves getter-backed constraints and migrations from a selected catalog', () => {
        let created = false;
        @reactor('catalog-rejection-reactor')
        class CatalogRejection {
            constructor() { created = true; }
            registered() {}
        }
        class SelectedConstraint {}
        class SelectedMigration {}
        const constrained = { eventTypes: [Registered], get constraints() { return [SelectedConstraint]; } };
        (() => new ReactorScenario(CatalogRejection, { artifacts: constrained })).should.throw(
            UnsupportedEventSequenceOperation, 'artifacts.constraints');
        const migrated = { eventTypes: [Registered], get eventTypeMigrations() { return [SelectedMigration]; } };
        (() => new ReactorScenario(CatalogRejection, { artifacts: migrated, constraints: 'disabled' })).should.throw(
            UnsupportedEventSequenceOperation, 'artifacts.eventTypeMigrations');
        created.should.be.false;
    });

    it('allows empty default constraint discovery without disabling constraints', async () => {
        const discover = vi.spyOn(TypeDiscoverer.default, 'getTypesByDecoratorType').mockImplementation(kind =>
            kind === DecoratorType.EventType ? [Registered] : []);
        try {
            const scenario = new ReactorScenario(ScenarioReactor);
            await scenario.when.forEventSource('A').events(new Registered('first'));
            scenario.results[0].completed.should.be.true;
        } finally {
            discover.mockRestore();
        }
    });

    it('rejects discovered constraint definitions', () => {
        class DiscoveredConstraint {}
        const discover = vi.spyOn(TypeDiscoverer.default, 'getTypesByDecoratorType').mockImplementation(kind => {
            if (kind === DecoratorType.EventType) return [Registered];
            if (kind === DecoratorType.Constraint) return [DiscoveredConstraint];
            return [];
        });
        try {
            (() => new ReactorScenario(ScenarioReactor)).should.throw(
                UnsupportedEventSequenceOperation, 'artifacts.constraints');
        } finally {
            discover.mockRestore();
        }
    });

    it('rejects discovered migrations even when constraints are explicitly disabled', () => {
        class DiscoveredMigration {}
        const discover = vi.spyOn(TypeDiscoverer.default, 'getTypesByDecoratorType').mockImplementation(kind => {
            if (kind === DecoratorType.EventType) return [Registered];
            if (kind === DecoratorType.EventTypeMigration) return [DiscoveredMigration];
            return [];
        });
        try {
            (() => new ReactorScenario(ScenarioReactor, { constraints: 'disabled' })).should.throw(
                UnsupportedEventSequenceOperation, 'artifacts.eventTypeMigrations');
        } finally {
            discover.mockRestore();
        }
    });

    it('rejects tag-filtered reactors before activation', () => {
        let created = false;
        @reactor('filtered-scenario-reactor')
        @filterEventsByTag('vip')
        class Filtered {
            constructor() { created = true; }
            registered() {}
        }
        (() => new ReactorScenario(Filtered, options)).should.throw(UnsupportedReactorOperation, 'reactor.filterEventsByTag');
        created.should.be.false;
    });

    it('keeps one event-type catalog after the caller changes its array', async () => {
        const eventTypes = [Registered, Skipped];
        const scenario = new ReactorScenario(ScenarioReactor, { ...options, artifacts: { eventTypes } });
        eventTypes.length = 0;
        await scenario.when.forEventSource('A').events(new Registered('first'));
        scenario.shouldHaveProduced(Registered, event => event.name === 'first');
        eventTypes.push(Registered);
        scenario.results[0].completed.should.be.true;
        @eventType('NotSelectedRecorded')
        class NotSelected {
            @field(String) label: string;
            constructor(label: string) { this.label = label; }
        }
        eventTypes.push(NotSelected);
        await scenario.when.forEventSource('B').events(new NotSelected('unexpected')).then(() => {
            throw new Error('expected rejection');
        }, error => { (error instanceof UnsupportedEventSequenceOperation).should.be.true; });
    });

    it('rejects unsupported promise-returning services asynchronously and preserves property probes', async () => {
        const errors: unknown[] = [];
        @reactor('service-rejection-reactor')
        class ServiceRejection {
            async registered(_event: Registered, _context: EventContext, services: ReactorServices) {
                (Reflect.get(services.readModels, 'then') === undefined).should.be.true;
                (Reflect.get(services.readModels, Symbol.toStringTag) === undefined).should.be.true;
                (Reflect.get(services.eventStore, 'then') === undefined).should.be.true;
                (Reflect.get(services.eventStore, Symbol.toStringTag) === undefined).should.be.true;
                const failures = [
                    services.readModels.register(),
                    services.readModels.getInstanceById(Registered, 'A'),
                    services.readModels.findInstanceById(Registered, 'A'),
                    services.readModels.getInstances(Registered),
                    services.readModels.getSnapshotsById(Registered, 'A'),
                    services.readModels.dehydrateSession('session', Registered, 'A'),
                    services.readModels.release(Registered, new Registered('one')),
                    services.readModels.releaseMany(Registered, [new Registered('one')]),
                    services.eventStore.getNamespaces()
                ];
                await Promise.all(failures.map(failure => failure.catch(error => { errors.push(error); })));
                try {
                    for await (const _change of services.readModels.watch(Registered)) { /* Unsupported. */ }
                } catch (error) { errors.push(error); }
            }
        }
        const scenario = new ReactorScenario(ServiceRejection, options);
        let failure: unknown;
        await scenario.when.forEventSource('A').events(new Registered('first')).catch(error => { failure = error; });
        errors.length.should.equal(10);
        errors.every(error => error instanceof UnsupportedReactorOperation && String(error).includes('Use a kernel-backed test.')).should.be.true;
        // Swallowed rejections still fail the delivery with the first unsupported operation.
        (failure === errors[0]).should.be.true;
        scenario.results[0].completed.should.be.false;
    });

    it('stops a multi-event delivery at the event whose handler swallowed an unsupported call', async () => {
        const invoked: string[] = [];
        @reactor('swallowed-in-batch-reactor')
        class SwallowedInBatch {
            async registered(event: Registered, _context: EventContext, services: ReactorServices) {
                invoked.push(event.name);
                await services.readModels.getInstances(Registered).catch(() => undefined);
                return new Skipped(`${event.name}-out`);
            }
        }
        const scenario = new ReactorScenario(SwallowedInBatch, options);
        let failure: unknown;
        await scenario.when.forEventSource('A').events(new Registered('first'), new Registered('second'))
            .catch(error => { failure = error; });
        (failure instanceof UnsupportedReactorOperation).should.be.true;
        invoked.should.deep.equal(['first']);
        scenario.results[0].handled.length.should.equal(0);
        scenario.produced.length.should.equal(0);
    });

    it('fails the delivery when the handler catches an unsupported event-log operation', async () => {
        @reactor('swallowed-event-log-reactor')
        class SwallowedEventLog {
            async registered(_event: Registered, _context: EventContext, services: ReactorServices) {
                await services.eventStore.eventLog.completeStream('Orders', 'A').catch(() => undefined);
            }
        }
        const scenario = new ReactorScenario(SwallowedEventLog, options);
        let failure: unknown;
        await scenario.when.forEventSource('A').events(new Registered('first')).catch(error => { failure = error; });
        (failure instanceof UnsupportedEventSequenceOperation).should.be.true;
        scenario.results[0].completed.should.be.false;
        await scenario.when.forEventSource('A').events(new Registered('second')).then(() => {
            throw new Error('expected rejection');
        }, error => { String(error).should.contain('delivery.afterFailure'); });
    });

    it('fails the delivery when the handler catches an unsupported append', async () => {
        @reactor('swallowed-append-reactor')
        class SwallowedAppend {
            async registered(_event: Registered, _context: EventContext, services: ReactorServices) {
                await services.eventStore.eventLog.append('A', new Skipped('x'), { subject: 'x' }).catch(() => undefined);
                await services.eventStore.eventLog.appendMany('A', []).catch(() => undefined);
            }
        }
        const scenario = new ReactorScenario(SwallowedAppend, options);
        let failure: unknown;
        await scenario.when.forEventSource('A').events(new Registered('first')).catch(error => { failure = error; });
        (failure instanceof UnsupportedEventSequenceOperation).should.be.true;
        scenario.results[0].completed.should.be.false;
        await scenario.when.forEventSource('A').events(new Registered('second')).then(() => {
            throw new Error('expected rejection');
        }, error => { String(error).should.contain('delivery.afterFailure'); });
    });

    it('does not fail a running delivery for leftover work from an earlier delivery', async () => {
        let release!: () => void;
        const leftover = new Promise<void>(resolve => { release = resolve; });
        let straggler: Promise<unknown> | undefined;
        @reactor('leftover-work-reactor')
        class LeftoverWork {
            async registered(event: Registered, _context: EventContext, services: ReactorServices) {
                if (event.name === 'first') {
                    straggler = leftover.then(() => services.readModels.getInstances(Registered)).catch(() => undefined);
                } else {
                    release();
                    await straggler;
                }
            }
        }
        const scenario = new ReactorScenario(LeftoverWork, options);
        await scenario.when.forEventSource('A').events(new Registered('first'));
        await scenario.when.forEventSource('A').events(new Registered('second'));
        scenario.results.map(result => result.completed).should.deep.equal([true, true]);
    });

    it('does not attribute an unsupported call made after its delivery finished to a later delivery', async () => {
        let services!: ReactorServices;
        @reactor('detached-call-reactor')
        class DetachedCall {
            registered(_event: Registered, _context: EventContext, reactorServices: ReactorServices) { services = reactorServices; }
        }
        const scenario = new ReactorScenario(DetachedCall, options);
        await scenario.when.forEventSource('A').events(new Registered('first'));
        await services.readModels.getInstances(Registered).catch(() => undefined);
        await scenario.when.forEventSource('A').events(new Registered('second'));
        scenario.results.map(result => result.completed).should.deep.equal([true, true]);
    });

    it('fails the delivery when the handler catches a subscribed self-append rejection', async () => {
        let log!: IEventLog;
        @reactor('swallowed-self-append-reactor')
        class SwallowedSelfAppend {
            async registered(event: Registered, _context: EventContext, services: ReactorServices) {
                log = services.eventStore.eventLog;
                try { await log.append('A', new Registered(event.name + '-follow')); } catch { /* Swallowed on purpose. */ }
            }
        }
        const scenario = new ReactorScenario(SwallowedSelfAppend, options);
        let failure: unknown;
        await scenario.when.forEventSource('A').events(new Registered('first')).catch(error => { failure = error; });
        (failure instanceof UnsupportedReactorOperation).should.be.true;
        String(failure).should.contain('services.eventLog.append.subscribed');
        scenario.results[0].completed.should.be.false;
        (await log.getNextSequenceNumber()).value.should.equal(1n);
    });

    it('does not create unhandled rejections for JSON serialization probes of services', async () => {
        @reactor('serialized-services-reactor')
        class SerializedServices {
            registered(_event: Registered, _context: EventContext, services: ReactorServices) {
                JSON.stringify(services, (_key, value: unknown) => typeof value === 'bigint' ? value.toString() : value);
                (Reflect.get(services.readModels, 'toJSON') === undefined).should.be.true;
                (Reflect.get(services.eventStore, 'toJSON') === undefined).should.be.true;
                (Reflect.get(services.eventStore, 'notAStoreMember') === undefined).should.be.true;
            }
        }
        const scenario = new ReactorScenario(SerializedServices, options);
        await scenario.when.forEventSource('A').events(new Registered('first'));
        scenario.results[0].completed.should.be.true;
    });

    it('passes an explicit services event-store double to the handler', async () => {
        const readModels = {} as ReactorServices['readModels'];
        const store = { readModels } as IEventStore;
        @reactor('explicit-store-reactor')
        class ExplicitStore {
            registered(_event: Registered, _context: EventContext, services: ReactorServices) {
                services.eventStore.should.equal(store);
                services.readModels.should.equal(readModels);
            }
        }
        const scenario = new ReactorScenario(ExplicitStore, { ...options, servicesEventStore: store });
        await scenario.when.forEventSource('A').events(new Registered('first'));
        scenario.results[0].completed.should.be.true;
    });

    it('provides real event-store identifiers with string conversion', async () => {
        const identifiers: string[] = [];
        @reactor('store-name-reactor')
        class StoreNames {
            registered(_event: Registered, _context: EventContext, services: ReactorServices) {
                identifiers.push(String(services.eventStore.name), `${services.eventStore.namespace}`);
            }
        }
        const scenario = new ReactorScenario(StoreNames, options);
        await scenario.when.forEventSource('A').events(new Registered('first'));
        identifiers.should.deep.equal(['test-event-store', 'default']);
    });

    it('rejects later deliveries after a failed batch without appending them', async () => {
        const handled: string[] = [];
        let log!: IEventLog;
        @reactor('failed-partition-reactor')
        class Failing {
            registered(event: Registered, _context: EventContext, services: ReactorServices) {
                log = services.eventStore.eventLog;
                handled.push(event.name);
                if (event.name === 'bad') throw new Error('processing failed');
            }
        }
        const scenario = new ReactorScenario(Failing, options);
        await scenario.when.forEventSource('A').events(new Registered('bad'), new Registered('tail')).then(() => {
            throw new Error('expected rejection');
        }, error => { String(error).should.contain('processing failed'); });
        for (const source of ['A', 'B']) {
            await scenario.when.forEventSource(source).events(new Registered('next')).then(() => {
                throw new Error('expected rejection');
            }, error => {
                (error instanceof UnsupportedReactorOperation).should.be.true;
                String(error).should.contain('delivery.afterFailure');
            });
        }
        handled.should.deep.equal(['bad']);
        scenario.results.length.should.equal(1);
        scenario.results[0].completed.should.be.false;
        (await log.getNextSequenceNumber()).value.should.equal(2n);
    });

    it('rejects an explicit append of a subscribed event before it enters history', async () => {
        let log!: IEventLog;
        @reactor('self-append-reactor')
        class SelfAppend {
            async registered(event: Registered, _context: EventContext, services: ReactorServices) {
                log = services.eventStore.eventLog;
                await log.append('A', new Registered(event.name + '-follow'));
            }
        }
        const scenario = new ReactorScenario(SelfAppend, options);
        await scenario.when.forEventSource('A').events(new Registered('first')).then(() => {
            throw new Error('expected rejection');
        }, error => {
            (error instanceof UnsupportedReactorOperation).should.be.true;
            String(error).should.contain('services.eventLog.append.subscribed');
        });
        scenario.results[0].completed.should.be.false;
        (await log.getNextSequenceNumber()).value.should.equal(1n);
    });

    it('records an explicit append of an unobserved event without delivering it', async () => {
        let log!: IEventLog;
        const handled: string[] = [];
        @reactor('unobserved-append-reactor')
        class UnobservedAppend {
            async registered(event: Registered, _context: EventContext, services: ReactorServices) {
                log = services.eventStore.eventLog;
                handled.push(event.name);
                await log.append('A', new Skipped('not observed'));
            }
        }
        const scenario = new ReactorScenario(UnobservedAppend, options);
        await scenario.when.forEventSource('A').events(new Registered('first'));
        handled.should.deep.equal(['first']);
        (await log.getFromSequenceNumber(EventSequenceNumber.first)).length.should.equal(2);
    });

    it('rejects a mixed-source batch containing a subscribed follow-up event atomically', async () => {
        let log!: IEventLog;
        @reactor('self-append-batch-reactor')
        class SelfAppendBatch {
            async registered(_event: Registered, _context: EventContext, services: ReactorServices) {
                log = services.eventStore.eventLog;
                await log.appendMany([
                    { eventSourceId: 'B', event: new Skipped('allowed') },
                    { eventSourceId: 'A', event: new Registered('not allowed') }
                ]);
            }
        }
        const scenario = new ReactorScenario(SelfAppendBatch, options);
        await scenario.when.forEventSource('A').events(new Registered('first')).then(() => {
            throw new Error('expected rejection');
        }, error => { String(error).should.contain('services.eventLog.append.subscribed'); });
        (await log.getNextSequenceNumber()).value.should.equal(1n);
    });

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

    it('lets a result handler claim an effect without recording it', async () => {
        const store = { readModels: {} } as IEventStore;
        const received: unknown[] = [];
        const scenario = new ReactorScenario(ScenarioReactor, { ...options, servicesEventStore: store,
            resultHandler: (result, context, reactorType, eventStore, namespace) => {
                received.push(result, context.eventSourceId, reactorType, eventStore, namespace);
                return true;
            } });
        await scenario.when.forEventSource('A').events(new Registered('first'));
        received.length.should.equal(5);
        (received[0] as { event: Registered }).event.name.should.equal('first');
        received.slice(1).should.deep.equal(['A', ScenarioReactor, 'test-event-store', 'default']);
        scenario.produced.length.should.equal(0);
        scenario.sideEffects.length.should.equal(0);
    });

    it('records returned events when a result handler declines them', async () => {
        let invoked = 0;
        const scenario = new ReactorScenario(ScenarioReactor, { ...options,
            resultHandler: async () => { invoked++; return false; } });
        await scenario.when.forEventSource('A').events(new Registered('first'));
        invoked.should.equal(1);
        scenario.shouldHaveProduced(Registered, event => event.name === 'first');
        scenario.sideEffects.length.should.equal(1);
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
