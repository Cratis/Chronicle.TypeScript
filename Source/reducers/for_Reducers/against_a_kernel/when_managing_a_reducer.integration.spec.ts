// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, chai, describe, it } from 'vitest';
import { field } from '@cratis/fundamentals';
import { ChronicleClient } from '../../../ChronicleClient.js';
import { ChronicleOptions } from '../../../ChronicleOptions.js';
import type { IClientArtifactsProvider } from '../../../artifacts/index.js';
import { eventType } from '../../../events/index.js';
import type { IEventStore } from '../../../IEventStore.js';
import { ObserverRunningState } from '../../../observation/ObserverRunningState.js';
import type { ObserverReplayResult } from '../../../observation/ObserverReplayResult.js';
import type { ObserverState } from '../../../observation/ObserverState.js';
import { readModel } from '../../../readModels/index.js';
import { reducer } from '../../reducer.js';

chai.should();

// Runs against a real Chronicle kernel; skipped locally unless the connection string is set (see vitest.integration.config.ts).
// In CI it never skips, so a missing connection string or unreachable kernel fails instead of passing vacuously.
const connectionString = process.env.CHRONICLE_INTEGRATION_CONNECTION_STRING;

@eventType()
class CounterIncremented {
    @field(Number) amount = 0;
}

@readModel()
class ManagedCounter {
    @field(Number) total = 0;
}

@reducer('manage-counter', undefined, ManagedCounter)
class ManagedCounterReducer {
    counterIncremented(event: CounterIncremented, state: ManagedCounter | undefined) {
        return Object.assign(new ManagedCounter(), { total: (state?.total ?? 0) + event.amount });
    }
}

const artifacts: IClientArtifactsProvider = {
    eventTypes: [CounterIncremented],
    readModels: [ManagedCounter],
    reactors: [],
    reducers: [ManagedCounterReducer],
    seeders: [],
    constraints: [],
    projections: [],
    webhooks: [],
    eventTypeMigrations: [],
    globalForHandlers: []
};

async function eventually<T>(read: () => Promise<T>, accept: (value: T) => boolean, timeoutMs = 30_000): Promise<T> {
    const deadline = Date.now() + timeoutMs;
    let value = await read();
    while (!accept(value)) {
        if (Date.now() > deadline) throw new Error('Timed out waiting for the kernel');
        await new Promise(resolve => setTimeout(resolve, 250));
        value = await read();
    }
    return value;
}

describe.skipIf(!connectionString && !process.env.CI)('when managing a reducer against a kernel', () => {
    const storeName = `ManageReducer${randomUUID().replaceAll('-', '').slice(0, 12)}`;
    let client: ChronicleClient;
    let store: IEventStore;
    let state: ObserverState;
    let replay: ObserverReplayResult;

    beforeAll(async () => {
        client = new ChronicleClient(ChronicleOptions.fromConnectionString(connectionString!, {
            discoveryPatterns: [],
            clientArtifactsProvider: artifacts
        }));
        store = await client.getEventStore(storeName);

        const event = new CounterIncremented();
        event.amount = 1;
        await store.eventLog.append(randomUUID(), event);
        state = await eventually(() => store.reducers.getStateFor(ManagedCounterReducer),
            value => value.isSubscribed && value.runningState === ObserverRunningState.Active && value.lastHandledEventSequenceNumber.value >= 0n
                && value.nextEventSequenceNumber.value > 0n);
        replay = await store.reducers.replay('manage-counter');
    });

    afterAll(() => client?.dispose());

    it('should report the reducer as subscribed and active on the event log', () => {
        state.isSubscribed.should.be.true;
        state.runningState.should.equal(ObserverRunningState.Active);
        state.eventSequenceId.value.should.equal('event-log');
    });
    it('should start a replay job', () => {
        replay.started.should.be.true;
        (replay.jobId !== undefined).should.be.true;
    });
});
