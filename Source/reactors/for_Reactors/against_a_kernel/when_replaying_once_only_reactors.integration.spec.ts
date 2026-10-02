// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, chai, describe, it } from 'vitest';
import { ObserverRunningState } from '@cratis/chronicle.contracts';
import { field } from '@cratis/fundamentals';
import { ChronicleClient } from '../../../ChronicleClient.js';
import { ChronicleOptions } from '../../../ChronicleOptions.js';
import type { IClientArtifactsProvider } from '../../../artifacts/index.js';
import type { ChronicleConnection } from '../../../connection/index.js';
import { eventType } from '../../../events/index.js';
import type { IEventStore } from '../../../IEventStore.js';
import { onceOnly } from '../../onceOnly.js';
import { reactor } from '../../reactor.js';

chai.should();

// Runs against a real Chronicle kernel; skipped locally unless the connection string is set (see vitest.integration.config.ts).
// In CI it never skips, so a missing connection string or unreachable kernel fails instead of passing vacuously.
const connectionString = process.env.CHRONICLE_INTEGRATION_CONNECTION_STRING;

@eventType()
class ThingHappened {
    @field(String) name = '';
}

// The client constructs reactor instances; share sinks for assertions across that boundary.
const onceOnlyInvocations: string[] = [];
const replayableInvocations: string[] = [];

@reactor()
@onceOnly()
class OnceOnlyReactor {
    thingHappened(event: ThingHappened) { onceOnlyInvocations.push(event.name); }
}

@reactor()
class ReplayableReactor {
    thingHappened(event: ThingHappened) { replayableInvocations.push(event.name); }
}

const artifacts: IClientArtifactsProvider = {
    eventTypes: [ThingHappened],
    readModels: [],
    reactors: [OnceOnlyReactor, ReplayableReactor],
    reducers: [],
    seeders: [],
    constraints: [],
    projections: [],
    webhooks: [],
    eventTypeMigrations: [],
    globalForHandlers: []
};

async function eventually(accept: () => boolean | Promise<boolean>, timeoutMs = 30_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (!await accept()) {
        if (Date.now() > deadline) throw new Error('Timed out waiting for the kernel');
        await new Promise(resolve => setTimeout(resolve, 250));
    }
}

const isEmptyJobId = (jobId: string | undefined) => /^[0-]*$/.test(jobId ?? '');

describe.skipIf(!connectionString && !process.env.CI)('when replaying reactors against a kernel', () => {
    const storeName = `Replay${randomUUID().replaceAll('-', '').slice(0, 12)}`;
    let client: ChronicleClient;
    let store: IEventStore;
    let connection: ChronicleConnection;
    let onceOnlyJobId: string | undefined;
    let replayableJobId: string | undefined;

    const replay = (observerId: string) => connection.observers.replay({
        EventStore: storeName,
        Namespace: 'Default',
        ObserverId: observerId,
        EventSequenceId: 'event-log'
    });

    const waitForActiveObservers = (lastHandledSequenceNumber?: bigint) => eventually(async () => {
        const observers = await Promise.all(['OnceOnlyReactor', 'ReplayableReactor'].map(observerId =>
            connection.observers.getObserverInformation({
                EventStore: storeName,
                Namespace: 'Default',
                ObserverId: observerId,
                EventSequenceId: 'event-log'
            })));
        return observers.every(observer => observer.IsSubscribed && observer.RunningState === ObserverRunningState.Active &&
            (lastHandledSequenceNumber === undefined || observer.LastHandledEventSequenceNumber === lastHandledSequenceNumber));
    }, 15_000);

    beforeAll(async () => {
        client = new ChronicleClient(ChronicleOptions.fromConnectionString(connectionString!, {
            discoveryPatterns: [],
            clientArtifactsProvider: artifacts
        }));
        store = await client.getEventStore(storeName);
        connection = (store as unknown as { _connection: ChronicleConnection })._connection;

        // Registration starts observation in the background. Append only after both subscriptions
        // are active, so initial catch-up cannot race the explicit replay's state transition.
        await waitForActiveObservers();
        const appended = await store.eventLog.append(randomUUID(), Object.assign(new ThingHappened(), { name: 'first' }));
        appended.isSuccess.should.be.true;
        await eventually(() => onceOnlyInvocations.length === 1 && replayableInvocations.length === 1);
        // The handlers update their sinks before the kernel acknowledges delivery and records progress.
        await waitForActiveObservers(appended.sequenceNumber.value);

        onceOnlyJobId = (await replay('OnceOnlyReactor')).JobId;
        replayableJobId = (await replay('ReplayableReactor')).JobId;
        await eventually(() => replayableInvocations.length === 2);
        await new Promise(resolve => setTimeout(resolve, 3_000));
    });

    afterAll(() => client?.dispose());

    it('should replay a reactor that is not once-only', () => {
        isEmptyJobId(replayableJobId).should.be.false;
        replayableInvocations.should.deep.equal(['first', 'first']);
    });

    it('should not start a replay of a class-level once-only reactor', () => {
        isEmptyJobId(onceOnlyJobId).should.be.true;
    });

    it('should not invoke a class-level once-only reactor again', () => {
        onceOnlyInvocations.should.deep.equal(['first']);
    });
});
