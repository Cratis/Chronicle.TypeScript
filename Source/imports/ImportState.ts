// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** The state of an import session. */
export enum ImportState {
    /** The import is open and has not received any chunk yet. */
    Open = 0,

    /** The import has received chunks and accepts more. */
    Staging = 1,

    /** Staging is closed and the whole import is being validated. */
    Validating = 2,

    /** The staged events are being committed to the event sequence. */
    Committing = 3,

    /** Every staged event was committed or reported. */
    Completed = 4,

    /** The import failed; when it failed before committing, nothing was committed. */
    Failed = 5,

    /** The import was abandoned before its commit started. */
    Abandoned = 6
}
