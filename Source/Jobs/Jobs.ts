// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { JobError, type Job, type JobStep } from '@cratis/chronicle.contracts';
import { Guid } from '@cratis/fundamentals';
import { ChronicleConnection } from '../connection';
import { toContractsGuid } from '../connection/Guid';
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
        await this._connection.jobs.stop(this.createJobRequest(jobId));
    }

    /** @inheritdoc */
    async resume(jobId: JobId | Guid | string): Promise<void> {
        await this._connection.jobs.resume(this.createJobRequest(jobId));
    }

    /** @inheritdoc */
    async delete(jobId: JobId | Guid | string): Promise<void> {
        await this._connection.jobs.delete(this.createJobRequest(jobId));
    }

    /** @inheritdoc */
    async getJob(jobId: JobId | Guid | string): Promise<Job | undefined> {
        const result = await this._connection.jobs.getJob(this.createJobRequest(jobId));
        if (result.Value0) {
            return result.Value0;
        }
        if (result.Value1 === JobError.NotFound) {
            return undefined;
        }
        return undefined;
    }

    /** @inheritdoc */
    async getJobs(): Promise<Job[]> {
        const response = await this._connection.jobs.getJobs({
            EventStore: this._eventStore,
            Namespace: this._namespace
        });

        return response.items ?? [];
    }

    /** @inheritdoc */
    async getJobSteps(jobId: JobId | Guid | string): Promise<JobStep[]> {
        const response = await this._connection.jobs.getJobSteps(this.createJobRequest(jobId));
        return response.items ?? [];
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
