// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { JobId } from '../jobs/JobId.js';

/**
 * Represents what Chronicle reported when asked to replay an observer.
 * A started job is acceptance, not completion.
 */
export interface ObserverReplayResult {
    /** Whether Chronicle started a replay job. False when it did not, for example for an unknown or non-replayable observer. */
    readonly started: boolean;

    /** The identifier of the replay job, present only when a job was started. */
    readonly jobId?: JobId;
}
