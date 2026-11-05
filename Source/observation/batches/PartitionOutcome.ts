// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { ObservationState } from '@cratis/chronicle.contracts';

/** The outcome of observing the events of one partition of a delivery. */
export interface PartitionOutcome {
    /** The partition. */
    readonly partition: string;
    /** The settled state of the partition. */
    readonly state: ObservationState;
    /** The last event of the partition that was observed successfully. */
    readonly lastSuccessfulObservation: bigint;
    /** The messages describing a failure. */
    readonly exceptionMessages: readonly string[];
    /** The stack trace of a failure. */
    readonly exceptionStackTrace: string;
    /** How long to wait before delivering again, for a deferral. */
    readonly retryAfterMilliseconds: number;
    /** The reduced read model state as JSON, for reducers. */
    readonly readModelState?: string;
}
