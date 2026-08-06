// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { EventSequenceNumber } from '../eventSequences/EventSequenceNumber';

/**
 * Represents a single failed attempt at processing a partition.
 */
export interface FailedPartitionAttempt {
    /** When the attempt occurred. */
    readonly occurred: Date;

    /** The event sequence number the attempt occurred at. */
    readonly sequenceNumber: EventSequenceNumber;

    /** The messages associated with the failure. */
    readonly messages: ReadonlyArray<string>;

    /** The associated stack trace, if any. */
    readonly stackTrace: string;
}
