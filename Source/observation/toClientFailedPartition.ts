// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { FailedPartition as ContractsFailedPartition } from '@cratis/chronicle.contracts';
import { fromContractsGuid } from '../connection/Guid';
import { EventSequenceNumber } from '../eventSequences/EventSequenceNumber';
import { FailedPartition } from './FailedPartition';

/**
 * Converts a wire {@link ContractsFailedPartition} into the client {@link FailedPartition} shape.
 * @param failedPartition - The wire failed partition to convert.
 * @returns The converted client failed partition.
 */
export function toClientFailedPartition(failedPartition: ContractsFailedPartition): FailedPartition {
    return {
        id: fromContractsGuid(failedPartition.Id).toString(),
        observerId: failedPartition.ObserverId,
        partition: failedPartition.Partition,
        attempts: (failedPartition.Attempts ?? []).map(attempt => ({
            occurred: new Date(attempt.Occurred?.Value ?? ''),
            sequenceNumber: new EventSequenceNumber(attempt.SequenceNumber ?? 0n),
            messages: attempt.Messages ?? [],
            stackTrace: attempt.StackTrace ?? ''
        }))
    };
}
