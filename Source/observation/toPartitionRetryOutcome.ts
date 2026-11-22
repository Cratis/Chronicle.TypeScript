// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { PartitionRecoveryOutcome } from '@cratis/chronicle.contracts';
import { PartitionRetryOutcome } from './PartitionRetryOutcome.js';

/**
 * Converts a wire {@link PartitionRecoveryOutcome} into the client {@link PartitionRetryOutcome}.
 * An unrecognized value maps to {@link PartitionRetryOutcome.Unknown}, never to success, and does not throw,
 * so a partition that may have started recovering is not hidden behind an exception.
 * @param outcome - The wire outcome to convert.
 * @returns The converted client outcome.
 */
export function toPartitionRetryOutcome(outcome: PartitionRecoveryOutcome): PartitionRetryOutcome {
    switch (outcome) {
        case PartitionRecoveryOutcome.Started:
            return PartitionRetryOutcome.Started;
        case PartitionRecoveryOutcome.PartitionNotFound:
            return PartitionRetryOutcome.PartitionNotFound;
        case PartitionRecoveryOutcome.ObserverQuarantined:
            return PartitionRetryOutcome.ObserverQuarantined;
        case PartitionRecoveryOutcome.PartitionQuarantined:
            return PartitionRetryOutcome.PartitionQuarantined;
        default:
            return PartitionRetryOutcome.Unknown;
    }
}
