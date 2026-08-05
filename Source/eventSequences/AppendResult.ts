// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { AppendError } from './AppendError';
import { ConstraintViolation } from './ConstraintViolation';
import { EventSequenceNumber } from './EventSequenceNumber';
import { WaitForCompletionResult } from './WaitForCompletionResult';

/**
 * Represents the result of appending a single event to an event sequence.
 */
export interface AppendResult {
    /** The sequence number assigned to the appended event. */
    readonly sequenceNumber: EventSequenceNumber;

    /** Constraint violations that occurred, if any. */
    readonly constraintViolations: ReadonlyArray<ConstraintViolation>;

    /** Errors that occurred during appending, if any. */
    readonly errors: ReadonlyArray<AppendError>;

    /** Whether the append was successful (no violations or errors). */
    readonly isSuccess: boolean;

    /**
     * Waits for all observers affected by this append to either process up to the appended tail
     * sequence number or fail.
     * @param timeoutMs - Optional timeout in milliseconds. Defaults to 5000 (5 seconds).
     * @returns A {@link WaitForCompletionResult} describing completion and any failures.
     * @remarks
     * When the append itself did not succeed (constraint violations or errors), there is nothing to
     * wait for and this resolves immediately with `{ isSuccess: true, failedPartitions: [] }`.
     */
    waitForCompletion(timeoutMs?: number): Promise<WaitForCompletionResult>;
}
