// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { AppendError } from './AppendError';
import { ConstraintViolation } from './ConstraintViolation';
import { EventSequenceNumber } from './EventSequenceNumber';

export type { AppendError } from './AppendError';
export type { ConstraintViolation } from './ConstraintViolation';

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
}
