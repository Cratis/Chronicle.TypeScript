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
import { PartitionRetryOutcome } from '../../../observation/PartitionRetryOutcome.js';
import type { ObserverReplayResult } from '../../../observation/ObserverReplayResult.js';
import type { ObserverState } from '../../../observation/ObserverState.js';
import { reactor } from '../../reactor.js';

chai.should();

// Runs against a real Chronicle kernel; skipped locally unless the connection string is set (see vitest.integration.config.ts).
// In CI it never skips, so a missing connection string or unreachable kernel fails instead of passing vacuously.
const connectionString = process.env.CHRONICLE_INTEGRATION_CONNECTION_STRING;

@eventType()
class ThingHappened {
    @field(String) name = '';
}

// The client constructs reactor instances; share state for assertions and control across that boundary.
const failFor = new Set<string>();
const handledByFirst: string[] = [];
const handledBySecond: string[] = [];

@reactor('manage-flaky')
class FlakyReactor {
    thingHappened(_event: ThingHappened, context: { eventSourceId: string }) {
        if (failFor.has(context.eventSourceId)) throw new Error('induced failure');
    }
}

@reactor('manage-first')
class FirstReactor {
    thingHappened(event: ThingHappened) { handledByFirst.push(event.name); }
}

@reactor('manage-second')
class SecondReactor {
    thingHappened(event: ThingHappened) { handledBySecond.push(event.name); }
}

@reactor('manage-custom', 'manage-custom-sequence')
class CustomSequenceReactor {
    thingHappened() {}
}

const artifacts: IClientArtifactsProvider = {
    eventTypes: [ThingHappened],
    readModels: [],
    reactors: [FlakyReactor, FirstReactor, SecondReactor, CustomSequenceReactor],
    reducers: [],
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

describe.skipIf(!connectionString && !process.env.CI)('when managing a reactor against a kernel', () => {
    const storeName = `Manage${randomUUID().replaceAll('-', '').slice(0, 12)}`;
    const failingPartition = randomUUID();
    let client: ChronicleClient;
    let store: IEventStore;
    let customState: ObserverState;
    let unknownState: ObserverState;
    let unknownReplay: ObserverReplayResult;
    let unknownRetry: PartitionRetryOutcome;
    let retryOfHealthyPartition: PartitionRetryOutcome;
    let retryOfFailedPartition: PartitionRetryOutcome;
    let failedPartitionObserved: boolean;
    let replayOfFirst: ObserverReplayResult;
    let secondHandledBeforeReplay: number;

    beforeAll(async () => {
        client = new ChronicleClient(ChronicleOptions.fromConnectionString(connectionString!, {
            discoveryPatterns: [],
            clientArtifactsProvider: artifacts
        }));
        store = await client.getEventStore(storeName);

        for (const id of ['manage-flaky', 'manage-first', 'manage-second', 'manage-custom']) await store.reactors.waitTillSubscribed(id, { timeout: 30_000 });
        customState = await eventually(() => store.reactors.getStateFor(CustomSequenceReactor), state => state.isSubscribed);
        unknownState = await store.reactors.getStateFor('manage-unknown');
        unknownReplay = await store.reactors.replay('manage-unknown');
        unknownRetry = await store.reactors.retryFailedPartition('manage-unknown', 'any');

        failFor.add(failingPartition);
        const healthyPartition = randomUUID();
        const failing = new ThingHappened();
        failing.name = 'failing';
        const healthy = new ThingHappened();
        healthy.name = 'healthy';
        await store.eventLog.append(failingPartition, failing);
        await store.eventLog.append(healthyPartition, healthy);

        await eventually(async () => handledByFirst.length === 2 && handledBySecond.length === 2, accept => accept);
        const failed = await eventually(() => store.reactors.getFailedPartitionsFor('manage-flaky'),
            partitions => partitions.some(partition => partition.partition === failingPartition));
        failedPartitionObserved = failed.some(partition => partition.partition === failingPartition);
        retryOfHealthyPartition = await store.reactors.retryFailedPartition(FlakyReactor, healthyPartition);

        // Started means a recovery job was accepted; this spec does not claim the partition has recovered.
        failFor.clear();
        retryOfFailedPartition = await store.reactors.retryFailedPartition(FlakyReactor, failingPartition);

        secondHandledBeforeReplay = handledBySecond.length;
        replayOfFirst = await store.reactors.replay(FirstReactor);
        await eventually(async () => handledByFirst.length >= 4, accept => accept);
        await new Promise(resolve => setTimeout(resolve, 2_000));
    });

    afterAll(() => client?.dispose());

    it('should report a reactor on a custom sequence as subscribed on that sequence', () => {
        customState.isSubscribed.should.be.true;
        customState.eventSequenceId.value.should.equal('manage-custom-sequence');
    });
    it('should report an unknown reactor as not subscribed', () => unknownState.isSubscribed.should.be.false);
    it('should not start a replay of an unknown reactor', () => unknownReplay.started.should.be.false);
    it('should find no failed partition for an unknown reactor', () => unknownRetry.should.equal(PartitionRetryOutcome.PartitionNotFound));
    it('should record the induced failure as a failed partition', () => failedPartitionObserved.should.be.true);
    it('should find no failure to retry for a healthy partition', () => retryOfHealthyPartition.should.equal(PartitionRetryOutcome.PartitionNotFound));
    it('should start recovery when retrying the failed partition', () => retryOfFailedPartition.should.equal(PartitionRetryOutcome.Started));
    it('should start a replay job for a known reactor', () => {
        replayOfFirst.started.should.be.true;
        (replayOfFirst.jobId !== undefined).should.be.true;
    });
    it('should replay the targeted reactor', () => handledByFirst.length.should.be.greaterThan(2));
    it('should not replay another reactor', () => handledBySecond.length.should.equal(secondHandledBeforeReplay));
    it('should report the replayed reactor as active again', async () => {
        const state = await eventually(() => store.reactors.getStateFor(FirstReactor), value => value.runningState === ObserverRunningState.Active);
        state.isSubscribed.should.be.true;
    });
});
