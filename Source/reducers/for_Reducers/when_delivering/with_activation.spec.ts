// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { EventContext, EventType, ReplayState, ObservationState, type ReducerMessage } from '@cratis/chronicle.contracts';
import { chai, describe, it } from 'vitest';
import type { ChronicleConnection } from '../../../connection/index.js';
import { ConnectionLifecycle } from '../../../connection/ConnectionLifecycle.js';
import type { IClientArtifactsProvider } from '../../../artifacts/IClientArtifactsProvider.js';
import { ArtifactDelivery } from '../../../artifacts/ArtifactDelivery.js';
import { ArtifactKind } from '../../../artifacts/ArtifactKind.js';
import type { ArtifactActivationContext } from '../../../artifacts/ArtifactActivationContext.js';
import type { ClientArtifactsActivator } from '../../../artifacts/ClientArtifactsActivator.js';
import type { IEventStore } from '../../../IEventStore.js';
import { eventType } from '../../../events/eventTypeDecorator.js';
import { reducer } from '../../reducer.js';
import { Reducers } from '../../Reducers.js';

chai.should();

@eventType('reduction-activation-event')
class ReductionEvent { constructor(readonly amount: number = 0) {} }
class ReductionState { count = 0; }

const instances: object[] = [];
const notifications: string[] = [];

@reducer('reduction-activation', undefined, ReductionState)
class CountingReducer {
    constructor() { instances.push(this); }
    beginReplay() { notifications.push('begin'); }
    endReplay() {}
    reductionEvent(event: ReductionEvent, state: ReductionState | undefined) {
        return { count: (state?.count ?? 0) + event.amount };
    }
}

@reducer('reduction-notification-failure', undefined, ReductionState)
class FailingNotificationReducer {
    beginReplay() { throw new Error('notification failed'); }
    endReplay() {}
    reductionEvent() { notifications.push('unexpected event'); return { count: 42 }; }
}

@reducer('reduction-failure', undefined, ReductionState)
class FailingReducer {
    reductionEvent() { throw new Error('reduction failed'); }
}

function event(amount: number, sequence: bigint) {
    return { Content: JSON.stringify({ amount }), Context: EventContext.fromPartial({
        EventType: EventType.fromPartial({ Id: 'reduction-activation-event', Generation: 1 }),
        EventSourceId: 'book-1', SequenceNumber: sequence
    }) };
}

function batch(events: ReturnType<typeof event>[], replayState = ReplayState.REPLAY_STATE_None) {
    return { Events: events, ReplayState: replayState, Partition: 'book-1', InitialState: '' };
}

async function observe(type: Function, batches: ReturnType<typeof batch>[], activator?: ClientArtifactsActivator) {
    const acknowledgements: NonNullable<ReducerMessage['Content']>['Value1'][] = [];
    const store = { namespace: { value: 'tenant-a' }, readModels: {} } as IEventStore;
    const lifecycle = new ConnectionLifecycle();
    let finished!: () => void;
    const complete = new Promise<void>(resolve => { finished = resolve; });
    async function* stream(queue: AsyncIterable<ReducerMessage>) {
        const messages = queue[Symbol.asyncIterator]();
        await messages.next();
        for (const delivery of batches) {
            yield delivery;
            acknowledgements.push((await messages.next()).value!.Content!.Value1);
        }
        await lifecycle.disconnected(error => { throw error; });
        finished();
    }
    const connection = { reducers: { observe: stream }, readModels: { registerMany: async () => ({}) } } as unknown as ChronicleConnection;
    const artifacts = { reducers: [type], eventTypes: [ReductionEvent], readModels: [] } as unknown as IClientArtifactsProvider;
    await new Reducers(artifacts, connection, 'store', 'tenant-a', lifecycle, 'sink', store, activator).register();
    await complete;
    return { acknowledgements, store };
}

describe('when delivering reducer batches', () => {
    it('should reuse the default instance across deliveries and preserve reduction state', async () => {
        instances.length = 0;
        const result = await observe(CountingReducer, [batch([event(1, 1n), event(2, 2n)]), batch([event(3, 3n)])]);
        instances.length.should.equal(1);
        result.acknowledgements.map(value => JSON.parse(value!.ReadModelState)).should.deep.equal([{ count: 3 }, { count: 3 }]);
    });

    it('should activate once per batch and separately for replay notifications', async () => {
        instances.length = 0;
        notifications.length = 0;
        const contexts: ArtifactActivationContext[] = [];
        const steps: string[] = [];
        const activator: ClientArtifactsActivator = (type, context) => {
            contexts.push(context);
            return { instance: new type(), run: async callback => { steps.push('enter');
                try { return await callback(); } finally { steps.push('exit'); } },
            dispose: () => { steps.push('dispose'); } };
        };
        const result = await observe(CountingReducer, [batch([event(1, 1n), event(2, 2n)], ReplayState.BeginReplay), batch([event(3, 3n)])], activator);
        instances.length.should.equal(3);
        contexts.map(context => context.delivery).should.deep.equal([ArtifactDelivery.ReplayNotification, ArtifactDelivery.Events, ArtifactDelivery.Events]);
        contexts[0].kind.should.equal(ArtifactKind.Reducer);
        contexts[1].eventStore.should.equal(result.store);
        contexts[1].readModels.should.equal(result.store.readModels);
        if (contexts[1].delivery === ArtifactDelivery.Events) contexts[1].eventContext.sequenceNumber.should.equal(1n);
        notifications.should.deep.equal(['begin']);
        steps.should.deep.equal(['enter', 'exit', 'dispose', 'enter', 'exit', 'enter', 'exit', 'dispose', 'enter', 'exit', 'dispose']);
        result.acknowledgements[0]?.ReadModelState.should.equal('{"count":3}');
    });

    it('should notify before events on the default path', async () => {
        notifications.length = 0;
        const result = await observe(CountingReducer, [batch([event(1, 1n)], ReplayState.BeginReplay)]);
        notifications.should.deep.equal(['begin']);
        result.acknowledgements[0]?.ReadModelState.should.equal('{"count":1}');
    });

    it('should fail notification without running events in either mode', async () => {
        for (const activator of [undefined, (type => ({ instance: new type() })) as ClientArtifactsActivator]) {
            notifications.length = 0;
            const result = await observe(FailingNotificationReducer, [batch([event(1, 1n)], ReplayState.BeginReplay)], activator);
            notifications.should.deep.equal([]);
            result.acknowledgements[0]?.State.should.equal(ObservationState.Failed);
            result.acknowledgements[0]?.ExceptionMessages.should.deep.equal(['Error: notification failed']);
        }
    });

    it('should dispose after handler failure without acknowledging the failed event', async () => {
        let disposed = 0;
        const activator: ClientArtifactsActivator = type => ({ instance: new type(), dispose: () => { disposed++; } });
        const result = await observe(FailingReducer, [batch([event(1, 1n)])], activator);
        disposed.should.equal(1);
        result.acknowledgements[0]?.State.should.equal(ObservationState.Failed);
        result.acknowledgements[0]?.ExceptionMessages.should.deep.equal(['Error: reduction failed']);
    });
});
