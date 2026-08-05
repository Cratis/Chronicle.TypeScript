// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { FailedPartition } from './FailedPartition';

/**
 * Defines a system that can work with failed partitions.
 */
export interface IFailedPartitions {
    /**
     * Gets any failed partitions for any observer (Reactor, Reducer, ++).
     * @returns A collection of {@link FailedPartition}.
     */
    getAllFailedPartitions(): Promise<FailedPartition[]>;

    /**
     * Gets any failed partitions for a specific observer (Reactor, Reducer, ++).
     * @param observerId - The identifier of the observer to get for.
     * @returns A collection of {@link FailedPartition}.
     */
    getFailedPartitionsFor(observerId: string): Promise<FailedPartition[]>;
}
