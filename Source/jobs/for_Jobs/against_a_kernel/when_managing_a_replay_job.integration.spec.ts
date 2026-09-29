// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, chai, describe, it } from 'vitest';
import { JobStatus, JobStepStatus, type JobStepSummaryResponse, type JobSummaryResponse } from '@cratis/chronicle.contracts';
import { field, Guid } from '@cratis/fundamentals';
import { ChronicleClient } from '../../../ChronicleClient.js';
import { ChronicleOptions } from '../../../ChronicleOptions.js';
import { fromContractsGuid } from '../../../connection/Guid.js';
import type { IClientArtifactsProvider } from '../../../artifacts/index.js';
import { eventType } from '../../../events/index.js';
import type { IEventStore } from '../../../IEventStore.js';
import { fromEvent } from '../../../projections/index.js';
import { JobId } from '../../JobId.js';

chai.should();

// Runs against a real Chronicle kernel; skipped locally unless the connection string is set (see vitest.integration.config.ts).
// In CI it never skips, so a missing connection string or unreachable kernel fails instead of passing vacuously.
const connectionString = process.env.CHRONICLE_INTEGRATION_CONNECTION_STRING;

@eventType()
class ItemAdded {
    @field(String) name = '';
}

@fromEvent(ItemAdded)
class Item {
    @field(String) name = '';
}

const artifacts: IClientArtifactsProvider = {
    eventTypes: [ItemAdded],
    readModels: [Item],
    reactors: [],
    reducers: [],
    seeders: [],
    constraints: [],
    projections: [],
    webhooks: [],
    eventTypeMigrations: [],
    globalForHandlers: []
};

async function eventually<T>(read: () => Promise<T>, accept: (value: T) => boolean, timeoutMs = 20_000): Promise<T> {
    const deadline = Date.now() + timeoutMs;
    let value = await read();
    while (!accept(value)) {
        if (Date.now() > deadline) throw new Error('Timed out waiting for the kernel');
        await new Promise(resolve => setTimeout(resolve, 100));
        value = await read();
    }
    return value;
}

describe.skipIf(!connectionString && !process.env.CI)('when managing a replay job against a kernel', () => {
    let client: ChronicleClient;
    let store: IEventStore;
    let jobId: JobId;
    let listed: JobSummaryResponse[];
    let stopped: JobSummaryResponse | undefined;
    let steps: JobStepSummaryResponse[];
    let afterDelete: JobSummaryResponse | undefined;
    let stopUnknownJob: unknown;
    let deleteUnknownJob: unknown;

    beforeAll(async () => {
        client = new ChronicleClient(ChronicleOptions.fromConnectionString(connectionString!, {
            discoveryPatterns: [],
            clientArtifactsProvider: artifacts
        }));
        store = await client.getEventStore(`JobsEndToEnd${randomUUID().replaceAll('-', '')}`);

        // Enough events that the replay is still running when it is stopped; a stopped job stays until deleted,
        // where a completed one is removed and could not be listed reliably.
        await store.eventLog.appendMany(Array.from({ length: 500 }, (_, index) => ({
            eventSourceId: randomUUID(),
            event: Object.assign(new ItemAdded(), { name: `Item ${index}` })
        })));

        jobId = await store.projections.replayForModel(Item);

        // Stopping a job in the instant it starts leaves its step running forever, so wait until it is running.
        await eventually(() => store.jobs.getJob(jobId), _ => _?.Status === JobStatus.JOB_STATUS_Running);
        await store.jobs.stop(jobId);

        listed = await store.jobs.getJobs();
        stopped = await eventually(() => store.jobs.getJob(jobId), _ => _?.Status === JobStatus.JOB_STATUS_Stopped);
        // The kernel updates step status asynchronously, after the job itself reports stopped.
        steps = await eventually(
            () => store.jobs.getJobSteps(jobId),
            _ => _.length > 0 && _.every(step => step.Status === JobStepStatus.JOB_STEP_STATUS_Stopped),
            30_000);

        await store.jobs.delete(jobId);
        afterDelete = await eventually(() => store.jobs.getJob(jobId), _ => _ === undefined);

        stopUnknownJob = await store.jobs.stop(randomUUID()).catch((error: unknown) => error);
        deleteUnknownJob = await store.jobs.delete(randomUUID()).catch((error: unknown) => error);
    });

    afterAll(() => client?.dispose());

    it('should start a replay job', () => jobId.toString().should.not.equal(Guid.empty.toString()));
    it('should list the job', () => listed.some(_ => fromContractsGuid(_.Id).toString() === jobId.toString()).should.be.true);
    it('should report the job as a replay', () => stopped!.Type.should.equal('ReplayObserver'));
    it('should report the job as stopped', () => stopped!.Status.should.equal(JobStatus.JOB_STATUS_Stopped));
    it('should list the steps of the job', () => steps.length.should.be.greaterThan(0));
    it('should report the steps as stopped', () => steps.every(_ => _.Status === JobStepStatus.JOB_STEP_STATUS_Stopped).should.be.true);
    it('should no longer list the deleted job', () => (afterDelete === undefined).should.be.true);
    it('should report stopping a job that does not exist', () => stopUnknownJob.should.be.instanceOf(Error));
    it('should report deleting a job that does not exist', () => deleteUnknownJob.should.be.instanceOf(Error));
});
