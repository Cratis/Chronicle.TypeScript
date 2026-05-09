// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Represents an error that occurred while appending an event.
 */
export interface AppendError {
    /** The error message describing the failure. */
    readonly message: string;
}
