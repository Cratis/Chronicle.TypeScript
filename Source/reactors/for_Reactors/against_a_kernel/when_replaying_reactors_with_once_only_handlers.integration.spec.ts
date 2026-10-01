// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, chai, describe, it } from 'vitest';
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

// 30s was occasionally too tight for this reactor's initial catch-up under concurrent
// kernel load in CI (observed timing out at 31.2s on a run that passed cleanly on retry
// with no code change); 45s keeps the polling assertion honest while tolerating that jitter.
async function eventually(accept: () => boolean, timeoutMs = 45_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (!accept()) {
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

    beforeAll(async () => {
        client = new ChronicleClient(ChronicleOptions.fromConnectionString(connectionString!, {
            discoveryPatterns: [],
            clientArtifactsProvider: artifacts
        }));
        store = await client.getEventStore(storeName);
        connection = (store as unknown as { _connection: ChronicleConnection })._connection;

        (await store.eventLog.append(randomUUID(), Object.assign(new MethodOnceOnlyHappened(), { name: 'a' }))).isSuccess.should.be.true;
        (await store.eventLog.append(randomUUID(), Object.assign(new MethodReplayableHappened(), { name: 'b' }))).isSuccess.should.be.true;
        (await store.eventLog.append(randomUUID(), Object.assign(new MethodReplayOnceOnlyHappened(), { name: 'c' }))).isSuccess.should.be.true;
        await eventually(() => invocations.length === 3);
        invocationsBeforeReplay = [...invocations];

        jobId = (await connection.observers.replay({
            EventStore: storeName,
            Namespace: 'Default',
            ObserverId: 'MixedOnceOnlyReactor',
            EventSequenceId: 'event-log'
        })).JobId;
        await eventually(() => invocations.includes('replayable:b') && invocations.filter(_ => _ === 'replayable:b').length === 2);
        await new Promise(resolve => setTimeout(resolve, 3_000));
    });

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
