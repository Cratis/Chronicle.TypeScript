// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { Guid } from '@cratis/fundamentals';
import type { Job, JobStep } from '@cratis/chronicle.contracts';
import { JobId } from './JobId';

/**
 * Defines the API for working with jobs in Chronicle.
 */
export interface IJobs {
    /**
     * Stops the job with the specified identifier.
     * @param jobId - The job identifier.
     */
    stop(jobId: JobId | Guid | string): Promise<void>;

    /**
     * Resumes the job with the specified identifier.
     * @param jobId - The job identifier.
     */
    resume(jobId: JobId | Guid | string): Promise<void>;

    /**
     * Deletes the job with the specified identifier.
     * @param jobId - The job identifier.
     */
    delete(jobId: JobId | Guid | string): Promise<void>;

    /**
     * Gets a job by identifier.
     * @param jobId - The job identifier.
     * @returns The job, or undefined when not found.
     */
    getJob(jobId: JobId | Guid | string): Promise<Job | undefined>;

    /**
     * Gets all jobs for the event store namespace.
     * @returns All jobs.
     */
    getJobs(): Promise<Job[]>;

    /**
     * Gets all steps for a specific job.
     * @param jobId - The job identifier.
     * @returns The job steps.
     */
    getJobSteps(jobId: JobId | Guid | string): Promise<JobStep[]>;
}
