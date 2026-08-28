// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { JobSummaryResponse, JobStepSummaryResponse } from '@cratis/chronicle.contracts';
import { Guid } from '@cratis/fundamentals';
import { ChronicleConnection } from '../connection';
import { ensureCommandSuccess, ensureQuerySuccess, firstQueryResult } from '../connection/callResults';
import { fromContractsGuid, toContractsGuid } from '../connection/Guid';
import { IJobs } from './IJobs';
import { JobId } from './JobId';

/**
 * Implements {@link IJobs}.
 */
export class Jobs implements IJobs {
    /**
     * Creates a new {@link Jobs} instance.
     * @param _eventStore - The event store name.
     * @param _namespace - The event store namespace.
     * @param _connection - Chronicle connection.
     */
    constructor(
        private readonly _eventStore: string,
        private readonly _namespace: string,
        private readonly _connection: ChronicleConnection
    ) {}

    /** @inheritdoc */
    async stop(jobId: JobId | Guid | string): Promise<void> {
        ensureCommandSuccess('stop job', await this._connection.jobs.stopJob(this.createJobRequest(jobId)));
    }

    /** @inheritdoc */
    async resume(jobId: JobId | Guid | string): Promise<void> {
        ensureCommandSuccess('resume job', await this._connection.jobs.resumeJob(this.createJobRequest(jobId)));
    }

    /** @inheritdoc */
    async delete(jobId: JobId | Guid | string): Promise<void> {
        ensureCommandSuccess('delete job', await this._connection.jobs.deleteJob(this.createJobRequest(jobId)));
    }

    /** @inheritdoc */
    async getJob(jobId: JobId | Guid | string): Promise<JobSummaryResponse | undefined> {
        const target = this.normalizeJobId(jobId).toString();
        const jobs = await this.getJobs();
        return jobs.find(job => fromContractsGuid(job.Id).toString() === target);
    }

    /** @inheritdoc */
    async getJobs(): Promise<JobSummaryResponse[]> {
        const response = await firstQueryResult('get jobs', this._connection.jobs.allJobs({
            EventStore: this._eventStore,
            Namespace: this._namespace
        }));

        return ensureQuerySuccess('get jobs', response);
    }

    /** @inheritdoc */
    async getJobSteps(jobId: JobId | Guid | string): Promise<JobStepSummaryResponse[]> {
        const response = await this._connection.jobs.getJobSteps(this.createJobRequest(jobId));
        return ensureQuerySuccess('get job steps', response);
    }

    private createJobRequest(jobId: JobId | Guid | string): { EventStore: string; Namespace: string; JobId: ReturnType<typeof toContractsGuid> } {
        return {
            EventStore: this._eventStore,
            Namespace: this._namespace,
            JobId: toContractsGuid(this.normalizeJobId(jobId))
        };
    }

    private normalizeJobId(jobId: JobId | Guid | string): Guid {
        if (typeof jobId === 'string') {
            return Guid.parse(jobId);
        }
        if (jobId instanceof JobId) {
            return jobId.value;
        }
        return jobId;
    }
}
