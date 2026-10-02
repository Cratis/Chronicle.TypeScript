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
import { replay } from '../../replay.js';

chai.should();

// Runs against a real Chronicle kernel; skipped locally unless the connection string is set (see vitest.integration.config.ts).
// In CI it never skips, so a missing connection string or unreachable kernel fails instead of passing vacuously.
const connectionString = process.env.CHRONICLE_INTEGRATION_CONNECTION_STRING;

@eventType()
class MethodOnceOnlyHappened {
    @field(String) name = '';
}

@eventType()
class MethodReplayableHappened {
    @field(String) name = '';
}

@eventType()
class MethodReplayOnceOnlyHappened {
    @field(String) name = '';
}

// The client constructs reactor instances; share a sink for assertions across that boundary.
const invocations: string[] = [];

@reactor()
class MixedOnceOnlyReactor {
    @onceOnly()
    methodOnceOnlyHappened(event: MethodOnceOnlyHappened) { invocations.push(`once-only:${event.name}`); }

    methodReplayableHappened(event: MethodReplayableHappened) { invocations.push(`replayable:${event.name}`); }

    methodReplayOnceOnlyHappened(event: MethodReplayOnceOnlyHappened) { invocations.push(`live:${event.name}`); }

    @replay()
    @onceOnly()
    replayMethodReplayOnceOnlyHappened(event: MethodReplayOnceOnlyHappened) { invocations.push(`replay:${event.name}`); }
}

const artifacts: IClientArtifactsProvider = {
    eventTypes: [MethodOnceOnlyHappened, MethodReplayableHappened, MethodReplayOnceOnlyHappened],
    readModels: [],
    reactors: [MixedOnceOnlyReactor],
    reducers: [],
    seeders: [],
    constraints: [],
    projections: [],
    webhooks: [],
    eventTypeMigrations: [],
    globalForHandlers: []
};

// Keep the existing 45s replay polling budget for concurrent kernel load in CI.
// Initial observation is gated separately by the bounded readiness waits below.
async function eventually(accept: () => boolean | Promise<boolean>, timeoutMs = 45_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (!await accept()) {
        if (Date.now() > deadline) throw new Error('Timed out waiting for the kernel');
        await new Promise(resolve => setTimeout(resolve, 250));
    }
}

const isEmptyJobId = (jobId: string | undefined) => /^[0-]*$/.test(jobId ?? '');

describe.skipIf(!connectionString && !process.env.CI)('when replaying a reactor with once-only handlers against a kernel', () => {
    const storeName = `Method${randomUUID().replaceAll('-', '').slice(0, 12)}`;
    let client: ChronicleClient;
    let store: IEventStore;
    let connection: ChronicleConnection;
    let jobId: string | undefined;
    let invocationsBeforeReplay: string[];

    const waitForActiveObserver = (lastHandledSequenceNumber?: bigint, timeoutMs = 15_000) => eventually(async () => {
        const observer = await connection.observers.getObserverInformation({
            EventStore: storeName,
            Namespace: 'Default',
            ObserverId: 'MixedOnceOnlyReactor',
            EventSequenceId: 'event-log'
        });
        return observer.IsSubscribed && observer.RunningState === ObserverRunningState.Active &&
            (lastHandledSequenceNumber === undefined || observer.LastHandledEventSequenceNumber === lastHandledSequenceNumber);
    }, timeoutMs);

    beforeAll(async () => {
        client = new ChronicleClient(ChronicleOptions.fromConnectionString(connectionString!, {
            discoveryPatterns: [],
            clientArtifactsProvider: artifacts
        }));
        store = await client.getEventStore(storeName);
        connection = (store as unknown as { _connection: ChronicleConnection })._connection;

        // Registration starts observation in the background. Append only after the subscription
        // is active, so initial catch-up cannot race the explicit replay's state transition.
        // Initial registration and subscription took over 30s under concurrent CI kernel load before.
        await waitForActiveObserver(undefined, 30_000);
        (await store.eventLog.append(randomUUID(), Object.assign(new MethodOnceOnlyHappened(), { name: 'a' }))).isSuccess.should.be.true;
        (await store.eventLog.append(randomUUID(), Object.assign(new MethodReplayableHappened(), { name: 'b' }))).isSuccess.should.be.true;
        const appended = await store.eventLog.append(randomUUID(), Object.assign(new MethodReplayOnceOnlyHappened(), { name: 'c' }));
        appended.isSuccess.should.be.true;
        // Worst case 30s + 30s + 15s + 45s + 3s stays inside the explicit 150s hook timeout below.
        await eventually(() => invocations.length === 3, 30_000);
        // The handlers update their sink before the kernel acknowledges delivery and records progress.
        await waitForActiveObserver(appended.sequenceNumber.value);
        invocationsBeforeReplay = [...invocations];

        jobId = (await connection.observers.replay({
            EventStore: storeName,
            Namespace: 'Default',
            ObserverId: 'MixedOnceOnlyReactor',
            EventSequenceId: 'event-log'
        })).JobId;
        await eventually(() => invocations.includes('replayable:b') && invocations.filter(_ => _ === 'replayable:b').length === 2);
        await new Promise(resolve => setTimeout(resolve, 3_000));
    }, 150_000);

    afterAll(() => client?.dispose());

    it('should run every handler once before the replay', () => {
        invocationsBeforeReplay.sort().should.deep.equal(['live:c', 'once-only:a', 'replayable:b']);
    });

    it('should start the replay', () => {
        isEmptyJobId(jobId).should.be.false;
    });

    it('should run the handler that is not once-only again', () => {
        invocations.filter(_ => _ === 'replayable:b').length.should.equal(2);
    });

    it('should not run the once-only handler again', () => {
        invocations.filter(_ => _ === 'once-only:a').length.should.equal(1);
    });

    it('should run neither the live nor the once-only replay handler again', () => {
        invocations.filter(_ => _.endsWith(':c')).sort().should.deep.equal(['live:c']);
    });
});
