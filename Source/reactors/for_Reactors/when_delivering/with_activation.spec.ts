// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { EventContext as WireContext, EventObservationState, EventType, ObservationState, type ReactorMessage } from '@cratis/chronicle.contracts';
import { ReplayState } from '../../../index.js';
import { chai, describe, it, vi } from 'vitest';
import { diag, DiagLogLevel, type DiagLogger } from '@opentelemetry/api';
import type { ChronicleConnection } from '../../../connection/index.js';
import { ConnectionLifecycle } from '../../../connection/ConnectionLifecycle.js';
import type { IClientArtifactsProvider } from '../../../artifacts/IClientArtifactsProvider.js';
import { ArtifactDelivery } from '../../../artifacts/ArtifactDelivery.js';
import { ArtifactKind } from '../../../artifacts/ArtifactKind.js';
import type { ArtifactActivationContext } from '../../../artifacts/ArtifactActivationContext.js';
import type { ArtifactInvocationContext } from '../../../artifacts/ArtifactInvocationContext.js';
import type { ClientArtifactsActivator } from '../../../artifacts/ClientArtifactsActivator.js';
import type { IEventStore } from '../../../IEventStore.js';
import type { IEventLog } from '../../../eventSequences/IEventLog.js';
import { eventType } from '../../../events/eventTypeDecorator.js';
import type { EventContext } from '../../../events/EventContext.js';
import type { ReactorServices } from '../../ReactorServices.js';
import { onceOnly } from '../../onceOnly.js';
import { reactor } from '../../reactor.js';
import { Reactors } from '../../Reactors.js';

chai.should();

@eventType('activation-event')
class ActivationEvent {
    constructor(readonly value: string = '') {}
}

const observed: string[] = [];
const instances: object[] = [];
const serviceReferences: ReactorServices[] = [];

@reactor('activation-reactor')
class ActivationReactor {
    constructor() { instances.push(this); }
    beginReplay() { observed.push('notification'); }
    endReplay() {}
    activationEvent(event: ActivationEvent, context: EventContext, services: ReactorServices) {
        serviceReferences.push(services);
        observed.push(`${event.value}:${context.eventSourceId}`);
    }
}

@reactor('legacy-reactor')
class LegacyReactor {
    constructor() { instances.push(this); }
    activationEvent(event: ActivationEvent, context: EventContext) { observed.push(`${event.value}:${context.eventSourceId}`); }
}

@reactor('dependency-reactor')
class DependencyReactor {
    constructor(private readonly dependency: { record(value: string): void }) {}
    activationEvent(event: ActivationEvent) { this.dependency.record(event.value); }
}

@reactor('one-argument-reactor')
class OneArgumentReactor {
    activationEvent(event: ActivationEvent) { observed.push(event.value); }
}

@reactor('append-reactor')
class AppendReactor {
    @onceOnly()
    async activationEvent(event: ActivationEvent, context: EventContext, services: ReactorServices) {
        serviceReferences.push(services);
        const model = await services.readModels.findInstanceById(ActivationEvent, context.eventSourceId);
        if (!model) throw new Error('model not ready');
        const result = await services.eventStore.eventLog.append(context.eventSourceId, new ActivationEvent(model.value));
        if (!result.isSuccess) throw new Error('append rejected');
        observed.push(`${event.value}:${model.value}`);
    }
}

@reactor('failing-notification-reactor')
class FailingNotificationReactor {
    beginReplay() { throw new Error('notification failed'); }
    endReplay() {}
    activationEvent() { observed.push('unexpected event'); }
}

@reactor('return-reactor')
class ReturnReactor {
    activationEvent() { observed.push('handler'); return new ActivationEvent('effect'); }
}

function event(value: string, sequence: bigint, observationState = EventObservationState.Initial) {
    return { Content: JSON.stringify({ value }), Context: WireContext.fromPartial({
        EventType: EventType.fromPartial({ Id: 'activation-event', Generation: 1 }),
        EventSourceId: 'book-1', SequenceNumber: sequence, ObservationState: observationState
    }) };
}

function delivery(events: ReturnType<typeof event>[], replayState = ReplayState.REPLAY_STATE_None) {
    return { Events: events, ReplayState: replayState, Partition: 'book-1', InitialState: '' };
}

async function observe(type: Function, batches: ReturnType<typeof delivery>[], namespace = 'tenant-a',
    activator?: ClientArtifactsActivator, appendResult = true, onAppendMany?: () => void) {
    const acknowledgements: NonNullable<ReactorMessage['Content']>['Value1'][] = [];
    const append = vi.fn().mockResolvedValue({ isSuccess: appendResult });
    const appendMany = vi.fn().mockImplementation(async () => {
        onAppendMany?.();
        return [{ isSuccess: true, errors: [], constraintViolations: [] }];
    });
    const findInstanceById = vi.fn().mockResolvedValue(new ActivationEvent('current'));
    const eventLog = { append, appendMany } as unknown as IEventLog;
    const store = { name: { value: 'store' }, namespace: { value: namespace }, eventLog,
        readModels: { findInstanceById } } as unknown as IEventStore;
    const lifecycle = new ConnectionLifecycle();
    let finished!: () => void;
    const complete = new Promise<void>(resolve => { finished = resolve; });
    async function* stream(queue: AsyncIterable<ReactorMessage>) {
        const messages = queue[Symbol.asyncIterator]();
        await messages.next(); // registration
        for (const batch of batches) {
            yield batch;
            acknowledgements.push((await messages.next()).value!.Content!.Value1);
        }
        await lifecycle.disconnected(error => { throw error; });
        finished();
    }
    const connection = { reactors: { observe: stream } } as unknown as ChronicleConnection;
    const artifacts = { reactors: [type], eventTypes: [ActivationEvent] } as unknown as IClientArtifactsProvider;
    await new Reactors(artifacts, connection, 'store', namespace, lifecycle, eventLog, undefined, store, activator).register();
    await complete;
    return { acknowledgements, store, append, appendMany, findInstanceById };
}

describe('when delivering reactor batches', () => {
    it('should reuse a default instance across deliveries and accept a two-argument handler', async () => {
        instances.length = 0;
        observed.length = 0;
        await observe(LegacyReactor, [delivery([event('first', 1n)]), delivery([event('second', 2n)])]);
        instances.length.should.equal(1);
        observed.should.deep.equal(['first:book-1', 'second:book-1']);
    });

    it('should accept a one-argument legacy handler', async () => {
        observed.length = 0;
        await observe(OneArgumentReactor, [delivery([event('first', 1n)])]);
        observed.should.deep.equal(['first']);
    });

    it('should await an asynchronous activator that resolves constructor dependencies', async () => {
        observed.length = 0;
        const activator: ClientArtifactsActivator = async type => {
            await Promise.resolve();
            return { instance: new type({ record: (value: string) => observed.push(value) }) };
        };
        const result = await observe(DependencyReactor, [delivery([event('injected', 1n)])], 'tenant-a', activator);
        observed.should.deep.equal(['injected']);
        result.acknowledgements[0]?.State.should.equal(ObservationState.Success);
    });

    it('should activate once per batch, wrap each handler, and dispose each lease', async () => {
        instances.length = 0;
        observed.length = 0;
        serviceReferences.length = 0;
        const contexts: ArtifactActivationContext[] = [];
        const invocations: ArtifactInvocationContext[] = [];
        const boundaries: string[] = [];
        const activator: ClientArtifactsActivator = (type, context) => {
            contexts.push(context);
            return { instance: new type(), run: async (callback, invocation) => { invocations.push(invocation!); boundaries.push('enter');
                try { return await callback(); } finally { boundaries.push('exit'); } },
            dispose: () => { boundaries.push('dispose'); } };
        };
        const result = await observe(ActivationReactor, [delivery([event('one', 1n), event('two', 2n)]), delivery([event('three', 3n)])], 'tenant-a', activator);
        instances.length.should.equal(2);
        contexts.map(context => context.delivery).should.deep.equal([ArtifactDelivery.Events, ArtifactDelivery.Events]);
        contexts[0].kind.should.equal(ArtifactKind.Reactor);
        contexts[0].artifactId.should.equal('activation-reactor');
        contexts[0].eventSequenceId.should.equal('event-log');
        contexts[0].partition.should.equal('book-1');
        contexts[0].eventStore.should.equal(result.store);
        contexts[0].readModels.should.equal(result.store.readModels);
        if (contexts[0].delivery === ArtifactDelivery.Events) contexts[0].eventContext.sequenceNumber.should.equal(1n);
        boundaries.should.deep.equal(['enter', 'exit', 'enter', 'exit', 'dispose', 'enter', 'exit', 'dispose']);
        invocations.map(invocation => invocation.delivery).should.deep.equal([ArtifactDelivery.Events, ArtifactDelivery.Events, ArtifactDelivery.Events]);
        invocations.map(invocation => invocation.delivery === ArtifactDelivery.Events ? invocation.eventContext.sequenceNumber : 0n)
            .should.deep.equal([1n, 2n, 3n]);
        invocations.map(invocation => invocation.delivery === ArtifactDelivery.Events ? invocation.methodName : '')
            .should.deep.equal(['activationEvent', 'activationEvent', 'activationEvent']);
        observed.should.deep.equal(['one:book-1', 'two:book-1', 'three:book-1']);
        serviceReferences.every(services => services.eventStore === result.store && services.readModels === result.store.readModels).should.be.true;
    });

    it('should isolate concurrent activations and handler services by owning store and namespace', async () => {
        observed.length = 0;
        serviceReferences.length = 0;
        const contexts: ArtifactActivationContext[] = [];
        let release!: () => void;
        const bothActivated = new Promise<void>(resolve => { release = resolve; });
        const activator: ClientArtifactsActivator = (type, context) => {
            contexts.push(context);
            if (contexts.length === 2) release();
            return { instance: new type(), run: async callback => { await bothActivated; return callback(); } };
        };
        const [first, second] = await Promise.all([
            observe(ActivationReactor, [delivery([event('first', 1n)])], 'tenant-a', activator),
            observe(ActivationReactor, [delivery([event('second', 2n)])], 'tenant-b', activator)
        ]);
        contexts.length.should.equal(2);
        contexts.find(context => context.eventStore.namespace.value === 'tenant-a')!.eventStore.should.equal(first.store);
        contexts.find(context => context.eventStore.namespace.value === 'tenant-b')!.eventStore.should.equal(second.store);
        serviceReferences.length.should.equal(2);
        serviceReferences.find(services => services.eventStore.namespace.value === 'tenant-a')!.eventStore.should.equal(first.store);
        serviceReferences.find(services => services.eventStore.namespace.value === 'tenant-b')!.eventStore.should.equal(second.store);
        serviceReferences[0].readModels.should.equal(serviceReferences[0].eventStore.readModels);
        serviceReferences[1].readModels.should.equal(serviceReferences[1].eventStore.readModels);
        observed.sort().should.deep.equal(['first:book-1', 'second:book-1']);
    });

    it('should keep returned side-effect dispatch inside the same boundary', async () => {
        const steps: string[] = [];
        const activator: ClientArtifactsActivator = type => ({ instance: new type(),
            run: async callback => { steps.push('enter'); const value = await callback(); steps.push('exit'); return value; },
            dispose: () => { steps.push('dispose'); } });
        observed.length = 0;
        const result = await observe(ReturnReactor, [delivery([event('one', 1n)])], 'tenant-a', activator, true, () => steps.push('append'));
        result.appendMany.mock.calls.length.should.equal(1);
        observed.should.deep.equal(['handler']);
        steps.should.deep.equal(['enter', 'append', 'exit', 'dispose']);
    });

    it('should bind append and read-model services to each namespace, and fail on a rejected append', async () => {
        observed.length = 0;
        serviceReferences.length = 0;
        const first = await observe(AppendReactor, [delivery([event('a', 1n)])], 'tenant-a');
        const second = await observe(AppendReactor, [delivery([event('b', 1n)])], 'tenant-b', undefined, false);
        first.acknowledgements[0]?.State.should.equal(ObservationState.Success);
        second.acknowledgements[0]?.State.should.equal(ObservationState.Failed);
        second.acknowledgements[0]?.ExceptionMessages.should.deep.equal(['Error: append rejected']);
        first.append.mock.calls.length.should.equal(1);
        second.append.mock.calls.length.should.equal(1);
        first.findInstanceById.mock.calls.length.should.equal(1);
        second.findInstanceById.mock.calls.length.should.equal(1);
        serviceReferences[0].eventStore.should.equal(first.store);
        serviceReferences[1].eventStore.should.equal(second.store);
        serviceReferences[0].readModels.should.equal(first.store.readModels);
        serviceReferences[1].readModels.should.equal(second.store.readModels);
        (serviceReferences[0].signal !== serviceReferences[1].signal).should.be.true;
    });

    it('should notify separately before processing events in the same message', async () => {
        observed.length = 0;
        const contexts: ArtifactActivationContext[] = [];
        const invocations: ArtifactInvocationContext[] = [];
        const activator: ClientArtifactsActivator = (type, context) => { contexts.push(context); return { instance: new type(),
            run: async (callback, invocation) => { invocations.push(invocation!); return callback(); } }; };
        const result = await observe(ActivationReactor, [delivery([event('live', 1n)], ReplayState.BeginReplay)], 'tenant-a', activator);
        observed.should.deep.equal(['notification', 'live:book-1']);
        invocations.should.deep.equal([
            { delivery: ArtifactDelivery.ReplayNotification, replayState: ReplayState.BeginReplay },
            { delivery: ArtifactDelivery.Events, eventContext: contexts[1].delivery === ArtifactDelivery.Events ? contexts[1].eventContext : undefined,
                methodName: 'activationEvent' }
        ]);
        contexts.map(context => context.delivery).should.deep.equal([ArtifactDelivery.ReplayNotification, ArtifactDelivery.Events]);
        result.acknowledgements[0]?.State.should.equal(ObservationState.Success);
    });

    it('should notify and then process the same message without an activator', async () => {
        observed.length = 0;
        instances.length = 0;
        const result = await observe(ActivationReactor, [delivery([event('one', 1n)], ReplayState.BeginReplay)]);
        observed.should.deep.equal(['notification', 'one:book-1']);
        instances.length.should.equal(1);
        result.acknowledgements[0]?.State.should.equal(ObservationState.Success);
    });

    it('should fail the partition on notification failure and not process its events in either mode', async () => {
        for (const activator of [undefined, (type => ({ instance: new type() })) as ClientArtifactsActivator]) {
            observed.length = 0;
            const result = await observe(FailingNotificationReactor, [delivery([event('one', 1n)], ReplayState.BeginReplay)], 'tenant-a', activator);
            observed.should.deep.equal([]);
            result.acknowledgements[0]?.State.should.equal(ObservationState.Failed);
            result.acknowledgements[0]?.ExceptionMessages.should.deep.equal(['Error: notification failed']);
        }
    });

    it('should skip replay-only excluded handlers before activation and acknowledge the event', async () => {
        let activations = 0;
        const activator: ClientArtifactsActivator = type => { activations++; return { instance: new type() }; };
        const result = await observe(AppendReactor, [delivery([event('one', 1n, EventObservationState.Replay)])], 'tenant-a', activator);
        activations.should.equal(0);
        result.acknowledgements[0]?.State.should.equal(ObservationState.Success);
        result.acknowledgements[0]?.LastSuccessfulObservation.should.equal(1n);
    });

    it('should use the first handled event context when earlier events are skipped', async () => {
        const contexts: ArtifactActivationContext[] = [];
        const activator: ClientArtifactsActivator = (type, context) => { contexts.push(context); return { instance: new type() }; };
        const result = await observe(AppendReactor, [delivery([
            event('replay', 1n, EventObservationState.Replay), event('live', 2n)
        ])], 'tenant-a', activator);
        contexts.length.should.equal(1);
        if (contexts[0].delivery === ArtifactDelivery.Events) contexts[0].eventContext.sequenceNumber.should.equal(2n);
        result.acknowledgements[0]?.LastSuccessfulObservation.should.equal(2n);
    });

    it('should dispose after a failed handler execution without acknowledging the failed event', async () => {
        let disposed = 0;
        const activator: ClientArtifactsActivator = type => ({ instance: new type(), dispose: () => { disposed++; } });
        const result = await observe(AppendReactor, [delivery([event('one', 1n)])], 'tenant-a', activator, false);
        disposed.should.equal(1);
        result.acknowledgements[0]?.State.should.equal(ObservationState.Failed);
    });

    it('should fail event delivery on synchronous and asynchronous activation errors without disposing a lease', async () => {
        for (const mode of ['sync', 'async'] as const) {
            observed.length = 0;
            const dispose = vi.fn();
            const message = `${mode} reactor activation failed`;
            const activator: ClientArtifactsActivator = type => {
                const lease = { instance: new type(), dispose };
                if (mode === 'sync') throw new Error(message);
                return Promise.reject(new Error(message)).then(() => lease);
            };
            const result = await observe(ActivationReactor, [delivery([event('one', 1n)])], 'tenant-a', activator);
            result.acknowledgements[0]?.State.should.equal(ObservationState.Failed);
            result.acknowledgements[0]?.ExceptionMessages.should.deep.equal([`Error: ${message}`]);
            result.acknowledgements[0]?.LastSuccessfulObservation.should.equal(4294967295n);
            observed.should.deep.equal([]);
            dispose.mock.calls.length.should.equal(0);
        }
    });

    it('should fail replay notification on synchronous and asynchronous activation errors without disposing a lease', async () => {
        for (const mode of ['sync', 'async'] as const) {
            observed.length = 0;
            const dispose = vi.fn();
            const message = `${mode} reactor replay activation failed`;
            const activator: ClientArtifactsActivator = type => {
                const lease = { instance: new type(), dispose };
                if (mode === 'sync') throw new Error(message);
                return Promise.reject(new Error(message)).then(() => lease);
            };
            const result = await observe(ActivationReactor, [delivery([event('one', 1n)], ReplayState.BeginReplay)], 'tenant-a', activator);
            result.acknowledgements[0]?.State.should.equal(ObservationState.Failed);
            result.acknowledgements[0]?.ExceptionMessages.should.deep.equal([`Error: ${message}`]);
            result.acknowledgements[0]?.LastSuccessfulObservation.should.equal(4294967295n);
            observed.should.deep.equal([]);
            dispose.mock.calls.length.should.equal(0);
        }
    });

    it('should use a new activation signal after reconnect rather than retaining the prior generation', async () => {
        const contexts: ArtifactActivationContext[] = [];
        const activator: ClientArtifactsActivator = (type, context) => { contexts.push(context); return { instance: new type() }; };
        const lifecycle = new ConnectionLifecycle();
        const eventLog = { appendMany: async () => [] } as unknown as IEventLog;
        const store = { eventLog, readModels: {} } as IEventStore;
        let delivered = 0;
        let firstDone!: () => void;
        let secondDone!: () => void;
        const first = new Promise<void>(resolve => { firstDone = resolve; });
        const second = new Promise<void>(resolve => { secondDone = resolve; });
        async function* stream(queue: AsyncIterable<ReactorMessage>) {
            const messages = queue[Symbol.asyncIterator]();
            await messages.next();
            const generation = ++delivered;
            yield delivery([event('one', BigInt(generation))]);
            await messages.next();
            if (generation === 1) {
                await lifecycle.disconnected(error => { throw error; });
                firstDone();
            } else {
                secondDone();
            }
        }
        const connection = { reactors: { observe: stream } } as unknown as ChronicleConnection;
        const artifacts = { reactors: [ActivationReactor], eventTypes: [ActivationEvent] } as unknown as IClientArtifactsProvider;
        const reactors = new Reactors(artifacts, connection, 'store', 'tenant-a', lifecycle, eventLog, undefined, store, activator);
        await reactors.register();
        await first;
        contexts[0].signal.aborted.should.be.true;
        await reactors.register();
        await second;
        contexts[1].signal.aborted.should.be.false;
        (contexts[0].signal !== contexts[1].signal).should.be.true;
        reactors.dispose();
    });

    it('should fail a replay notification when completion fails and suppress event handling', async () => {
        observed.length = 0;
        const steps: string[] = [];
        const activator: ClientArtifactsActivator = (type, context) => ({ instance: new type(),
            complete: () => { steps.push('complete'); if (context.delivery === ArtifactDelivery.ReplayNotification) throw new Error('replay cleanup'); },
            dispose: () => { steps.push('dispose'); } });
        const result = await observe(ActivationReactor, [delivery([event('one', 1n)], ReplayState.BeginReplay)], 'tenant-a', activator);
        observed.should.deep.equal(['notification']);
        steps.should.deep.equal(['complete', 'dispose']);
        result.acknowledgements[0]?.State.should.equal(ObservationState.Failed);
        result.acknowledgements[0]?.ExceptionMessages.should.deep.equal(['ArtifactCompletionFailed: Artifact completion failed: Error: replay cleanup']);
        result.acknowledgements[0]?.LastSuccessfulObservation.should.equal(4294967295n);
    });

    it('should preserve both replay notification and completion errors', async () => {
        const steps: string[] = [];
        const activator: ClientArtifactsActivator = type => ({ instance: new type(),
            complete: () => { steps.push('complete'); throw new Error('replay cleanup'); },
            dispose: () => { steps.push('dispose'); } });
        const result = await observe(FailingNotificationReactor, [delivery([event('one', 1n)], ReplayState.BeginReplay)], 'tenant-a', activator);
        steps.should.deep.equal(['complete', 'dispose']);
        result.acknowledgements[0]?.ExceptionMessages.should.deep.equal([
            'Error: notification failed', 'ArtifactCompletionFailed: Artifact completion failed: Error: replay cleanup'
        ]);
    });

    it('should complete each successful lease before acknowledgement and then dispose it', async () => {
        const steps: string[] = [];
        const activator: ClientArtifactsActivator = type => ({ instance: new type(),
            complete: () => { steps.push('complete'); }, dispose: () => { steps.push('dispose'); } });
        const result = await observe(ActivationReactor, [delivery([event('one', 1n), event('two', 2n)])], 'tenant-a', activator);
        steps.should.deep.equal(['complete', 'dispose']);
        result.acknowledgements[0]?.State.should.equal(ObservationState.Success);
    });

    it('should complete after processing failure before acknowledgement and preserve the processing error', async () => {
        const steps: string[] = [];
        const activator: ClientArtifactsActivator = type => ({ instance: new type(),
            complete: () => { steps.push('complete'); }, dispose: () => { steps.push('dispose'); } });
        const result = await observe(AppendReactor, [delivery([event('one', 1n)])], 'tenant-a', activator, false);
        steps.should.deep.equal(['complete', 'dispose']);
        result.acknowledgements[0]?.ExceptionMessages.should.deep.equal(['Error: append rejected']);
    });

    it('should fail completion distinctly without advancing a successful checkpoint and still dispose', async () => {
        const steps: string[] = [];
        const activator: ClientArtifactsActivator = type => ({ instance: new type(),
            complete: async () => { steps.push('complete'); throw new Error('scope cleanup'); },
            dispose: () => { steps.push('dispose'); } });
        const result = await observe(ActivationReactor, [delivery([event('one', 1n), event('two', 2n)])], 'tenant-a', activator);
        steps.should.deep.equal(['complete', 'dispose']);
        result.acknowledgements[0]?.State.should.equal(ObservationState.Failed);
        result.acknowledgements[0]?.LastSuccessfulObservation.should.equal(4294967295n);
        result.acknowledgements[0]?.ExceptionMessages.should.deep.equal(['ArtifactCompletionFailed: Artifact completion failed: Error: scope cleanup']);
    });

    it('should report both processing and completion errors without acknowledging earlier successful events', async () => {
        const steps: string[] = [];
        const activator: ClientArtifactsActivator = type => ({ instance: new type(),
            complete: () => { steps.push('complete'); throw new Error('scope cleanup'); },
            dispose: () => { steps.push('dispose'); } });
        const result = await observe(AppendReactor, [delivery([event('one', 1n), event('two', 2n)])], 'tenant-a', activator, false);
        steps.should.deep.equal(['complete', 'dispose']);
        result.acknowledgements[0]?.ExceptionMessages.should.deep.equal([
            'Error: append rejected', 'ArtifactCompletionFailed: Artifact completion failed: Error: scope cleanup'
        ]);
        result.acknowledgements[0]?.LastSuccessfulObservation.should.equal(4294967295n);
    });

    it('should leave a processing failure unchanged when legacy disposal also fails', async () => {
        const activator: ClientArtifactsActivator = type => ({ instance: new type(),
            dispose: () => { throw new Error('legacy cleanup'); } });
        const result = await observe(AppendReactor, [delivery([event('one', 1n)])], 'tenant-a', activator, false);
        result.acknowledgements[0]?.State.should.equal(ObservationState.Failed);
        result.acknowledgements[0]?.ExceptionMessages.should.deep.equal(['Error: append rejected']);
    });

    it('should log disposal failure without changing successful acknowledgement', async () => {
        const errors: string[] = [];
        diag.setLogger({ error: (...values: unknown[]) => { errors.push(values.map(String).join(' ')); } } as DiagLogger, DiagLogLevel.ERROR);
        try {
            const activator: ClientArtifactsActivator = type => ({ instance: new type(), dispose: async () => { throw new Error('cleanup'); } });
            const result = await observe(ActivationReactor, [delivery([event('live', 1n)])], 'tenant-a', activator);
            result.acknowledgements[0]?.State.should.equal(ObservationState.Success);
            result.acknowledgements[0]?.LastSuccessfulObservation.should.equal(1n);
            errors.some(value => value.includes('Error disposing activated artifact')).should.be.true;
        } finally {
            diag.disable();
        }
    });
});
