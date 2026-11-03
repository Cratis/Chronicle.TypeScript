// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Constructor } from '@cratis/fundamentals';
import {
    AppendedEvent, EventsToObserve, ObservationOrigin, ReplayState,
    type RegisterReactor, type ReactorMessage, type ReactorResult
} from '@cratis/chronicle.contracts';
import type { IClientArtifactsProvider } from '../../../artifacts/index.js';
import type { ChronicleConnection } from '../../../connection/index.js';
import { ConnectionLifecycle } from '../../../connection/ConnectionLifecycle.js';
import type { IEventLog } from '../../../eventSequences/IEventLog.js';
import type { IEventStore } from '../../../IEventStore.js';
import { Reactors } from '../../index.js';

/** Creates a delivered event of a type for an event source. */
export function appended(eventTypeId: string, eventSourceId: string, sequenceNumber: bigint, content: object = {}): AppendedEvent {
    return AppendedEvent.fromPartial({
        Content: JSON.stringify(content),
        Context: { EventType: { Id: eventTypeId, Generation: 1 }, EventSourceId: eventSourceId, SequenceNumber: sequenceNumber }
    });
}

/** Creates a page of partitions, as a kernel that delivers pages sends it. */
export function page(deliveryId: bigint, partitions: Record<string, AppendedEvent[]>, origin = ObservationOrigin.Live): EventsToObserve {
    return EventsToObserve.fromPartial({
        DeliveryId: deliveryId, Origin: origin, ReplayState: ReplayState.REPLAY_STATE_None,
        Partitions: Object.entries(partitions).map(([partition, events]) => ({ Partition: partition, Events: events }))
    });
}

/** Creates a legacy single-partition delivery, as a kernel that does not deliver pages sends it. */
export function single(partition: string, events: AppendedEvent[], deliveryId = 0n): EventsToObserve {
    return EventsToObserve.fromPartial({ DeliveryId: deliveryId, Partition: partition, Events: events, ReplayState: ReplayState.REPLAY_STATE_None });
}

/** Observes a reactor through the production observation stream, without a kernel. */
export async function observeReactorMessages(reactorType: Constructor, eventTypes: Constructor[], messages: EventsToObserve[]):
    Promise<{ registration: RegisterReactor; results: ReactorResult[] }> {
    const lifecycle = new ConnectionLifecycle();
    const results: ReactorResult[] = [];
    let registration!: RegisterReactor;
    let failure: unknown;
    let finish!: () => void;
    const finished = new Promise<void>(resolve => { finish = resolve; });
    async function* stream(queue: AsyncIterable<ReactorMessage>) {
        const outgoing = queue[Symbol.asyncIterator]();
        try {
            registration = (await outgoing.next()).value!.Content!.Value0!;
            for (const message of messages) {
                yield message;
                results.push((await outgoing.next()).value!.Content!.Value1!);
            }
        } catch (error) {
            failure = error;
        } finally {
            await lifecycle.disconnected(error => { throw error; });
            finish();
        }
    }
    const reactors = new Reactors({ reactors: [reactorType], eventTypes } as unknown as IClientArtifactsProvider,
        { reactors: { observe: stream } } as unknown as ChronicleConnection,
        'store', 'default', lifecycle, {} as IEventLog, undefined, { readModels: {} } as IEventStore);
    try {
        await reactors.register();
        await finished;
        if (failure) throw failure;
        return { registration, results };
    } finally {
        reactors.dispose();
    }
}
