// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { EventSequenceNumber } from './EventSequenceNumber';

/**
 * Represents a concurrency violation that occurred during an append operation.
 */
export interface ConcurrencyViolation {
    /** The event source identifier where the violation occurred. */
    readonly eventSourceId: string;

    /** The expected sequence number. */
    readonly expectedSequenceNumber: EventSequenceNumber;

    /** The actual sequence number. */
    readonly actualSequenceNumber: EventSequenceNumber;
}
