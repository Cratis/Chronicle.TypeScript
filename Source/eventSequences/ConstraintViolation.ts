// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

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
