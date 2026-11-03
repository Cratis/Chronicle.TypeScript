// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Constructor } from '@cratis/fundamentals';
import {
    AppendedEvent, ObservationOrigin, ReduceOperationMessage, ReplayState,
    type RegisterReducer, type ReducerMessage, type ReducerResult
} from '@cratis/chronicle.contracts';
import type { IClientArtifactsProvider } from '../../../artifacts/index.js';
import type { ChronicleConnection } from '../../../connection/index.js';
import { ConnectionLifecycle } from '../../../connection/ConnectionLifecycle.js';
import type { IEventStore } from '../../../IEventStore.js';
import { Reducers } from '../../Reducers.js';

/** Creates a delivered event of a type for an event source. */
export function appended(eventTypeId: string, eventSourceId: string, sequenceNumber: bigint, content: object = {}): AppendedEvent {
    return AppendedEvent.fromPartial({
        Content: JSON.stringify(content),
        Context: { EventType: { Id: eventTypeId, Generation: 1 }, EventSourceId: eventSourceId, SequenceNumber: sequenceNumber }
    });
}

/** The events and stored state of one event source in a page. */
export interface ReducerPartitionInput {
    readonly initialState?: object;
    readonly events: AppendedEvent[];
}

/** Creates a page of event sources, as a kernel that delivers pages sends it. */
export function page(deliveryId: bigint, partitions: Record<string, ReducerPartitionInput>, origin = ObservationOrigin.Live): ReduceOperationMessage {
    return ReduceOperationMessage.fromPartial({
        DeliveryId: deliveryId, Origin: origin, ReplayState: ReplayState.REPLAY_STATE_None,
        Partitions: Object.entries(partitions).map(([partition, input]) => ({
            Partition: partition, Events: input.events, InitialState: input.initialState ? JSON.stringify(input.initialState) : ''
        }))
    });
}

/** Creates a legacy single-partition operation, as a kernel that does not deliver pages sends it. */
export function single(partition: string, events: AppendedEvent[], initialState?: object): ReduceOperationMessage {
    return ReduceOperationMessage.fromPartial({
        Partition: partition, Events: events, InitialState: initialState ? JSON.stringify(initialState) : '', ReplayState: ReplayState.REPLAY_STATE_None
    });
}

/** Observes a reducer through the production observation stream, without a kernel. */
export async function observeReducerMessages(reducerType: Constructor, eventTypes: Constructor[], messages: ReduceOperationMessage[]):
    Promise<{ registration: RegisterReducer; results: ReducerResult[] }> {
    const lifecycle = new ConnectionLifecycle();
    const results: ReducerResult[] = [];
    let registration!: RegisterReducer;
    let finish!: () => void;
    const finished = new Promise<void>(resolve => { finish = resolve; });
    async function* stream(queue: AsyncIterable<ReducerMessage>) {
        const outgoing = queue[Symbol.asyncIterator]();
        try {
            registration = (await outgoing.next()).value!.Content!.Value0!;
            for (const message of messages) {
                yield message;
                results.push((await outgoing.next()).value!.Content!.Value1!);
            }
        } finally {
            await lifecycle.disconnected(error => { throw error; });
            finish();
        }
    }
    const connection = { reducers: { observe: stream }, readModels: { registerMany: async () => ({}) } } as unknown as ChronicleConnection;
    const artifacts = { reducers: [reducerType], eventTypes, readModels: [] } as unknown as IClientArtifactsProvider;
    const reducers = new Reducers(artifacts, connection, 'store', 'default', lifecycle, 'sink', { readModels: {} } as IEventStore);
    try {
        await reducers.register();
        await finished;
        return { registration, results };
    } finally {
        reducers.dispose();
    }
}
