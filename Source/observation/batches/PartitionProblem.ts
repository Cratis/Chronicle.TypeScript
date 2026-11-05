// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { ObservationState } from '@cratis/chronicle.contracts';

/** The first event of a partition that one method of an observer did not handle. */
export interface PartitionProblem {
    /** The partition. */
    readonly partition: string;

    /** The sequence number of the event. */
    readonly at: bigint;

    /** Whether the partition failed or was deferred. */
    readonly state: ObservationState.Failed | ObservationState.Deferred;

    /** The messages describing a failure. */
    readonly exceptionMessages: readonly string[];

    /** The stack trace of a failure. */
    readonly exceptionStackTrace: string;

    /** How long to wait before delivering again, for a deferral. */
    readonly retryAfterMilliseconds: number;
}
