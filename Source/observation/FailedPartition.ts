// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { FailedPartitionAttempt } from './FailedPartitionAttempt';

/**
 * Represents a partition that has failed for an observer (Reactor, Reducer, ++).
 */
export interface FailedPartition {
    /** The unique identifier of the failed partition registration. */
    readonly id: string;

    /** The identifier of the observer (Reactor, Reducer) the partition failed for. */
    readonly observerId: string;

    /** The partition that has failed. */
    readonly partition: string;

    /** The collection of attempts made at processing the partition. */
    readonly attempts: ReadonlyArray<FailedPartitionAttempt>;
}
