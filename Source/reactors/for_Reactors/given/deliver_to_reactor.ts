// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Constructor } from '@cratis/fundamentals';
import { ReplayState, type EventContext, type ReactorMessage } from '@cratis/chronicle.contracts';
import type { IClientArtifactsProvider } from '../../../artifacts/index.js';
import type { ClientArtifactsActivator } from '../../../artifacts/ClientArtifactsActivator.js';
import type { ChronicleConnection } from '../../../connection/index.js';
import { ConnectionLifecycle } from '../../../connection/ConnectionLifecycle.js';
import type { IEventLog } from '../../../eventSequences/IEventLog.js';
import type { IEventStore } from '../../../IEventStore.js';
import { Reactors } from '../../index.js';

/** Deliver through the production observation stream without a kernel. */
export async function deliverToReactor(reactorType: Constructor, eventType: Constructor,
    contexts: readonly EventContext[], artifactActivator?: ClientArtifactsActivator,
    eventStore = 'orders', namespace = 'default'): Promise<ReactorMessage[]> {
    const lifecycle = new ConnectionLifecycle();
    const results: ReactorMessage[] = [];
    let finish!: () => void;
    const finished = new Promise<void>(resolve => { finish = resolve; });
    async function* stream(queue: AsyncIterable<ReactorMessage>) {
        const messages = queue[Symbol.asyncIterator]();
        await messages.next();
        try {
            for (const context of contexts) {
                yield { Events: [{ Content: '{}', Context: context }], Partition: context.EventSourceId,
                    ReplayState: ReplayState.REPLAY_STATE_None, InitialState: '' };
                results.push((await messages.next()).value!);
            }
        } finally {
            await lifecycle.disconnected(error => { throw error; });
            finish();
        }
    }
    const reactors = new Reactors({ reactors: [reactorType], eventTypes: [eventType] } as unknown as IClientArtifactsProvider,
        { reactors: { observe: stream } } as unknown as ChronicleConnection,
        eventStore, namespace, lifecycle, {} as IEventLog, undefined,
        { readModels: {} } as IEventStore, artifactActivator);
    try {
        await reactors.register();
        await finished;
        return results;
    } finally {
        reactors.dispose();
    }
}
