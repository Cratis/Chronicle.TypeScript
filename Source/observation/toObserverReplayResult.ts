// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { JobId } from '../jobs/JobId.js';
import type { ObserverReplayResult } from './ObserverReplayResult.js';

const emptyJobId = /^[0-]*$/;

/**
 * Converts the job identifier of a wire replay response into an {@link ObserverReplayResult}.
 * A missing, empty or all-zero identifier means no job was started.
 * @param jobId - The wire job identifier.
 * @returns The replay result.
 */
export function toObserverReplayResult(jobId: string | undefined): ObserverReplayResult {
    if (!jobId || emptyJobId.test(jobId)) return { started: false };
    return { started: true, jobId: JobId.from(jobId) };
}
