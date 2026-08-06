// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { FailedPartition } from '../observation/FailedPartition';

/**
 * Represents the result of waiting for the observers affected by an append operation to catch up.
 */
export interface WaitForCompletionResult {
    /** Whether all affected observers completed successfully. */
    readonly isSuccess: boolean;

    /** The failed partitions discovered while waiting, across all affected observers. */
    readonly failedPartitions: ReadonlyArray<FailedPartition>;
}
