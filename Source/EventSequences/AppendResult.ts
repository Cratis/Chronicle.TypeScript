// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { EventSequenceNumber } from './EventSequenceNumber';

/**
 * Represents an error that occurred while appending an event.
 */
export interface AppendError {
    /** The error message describing the failure. */
    readonly message: string;
}

/**
 * Represents a constraint violation that occurred while appending an event.
 */
export interface ConstraintViolation {
    /** The constraint identifier that was violated. */
    readonly constraintId: string;

    /** The violation message. */
    readonly message: string;

    /** Additional details about the violation. */
    readonly details: Readonly<Record<string, string>>;
}

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
