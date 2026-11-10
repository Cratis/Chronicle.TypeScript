// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** What an import does when one of its events is invalid. */
export enum OnInvalidEvent {
    /** Fail the whole import and commit nothing. The default. */
    Reject = 0,

    /** Leave the invalid events out, report them, and commit the rest. */
    Skip = 1
}
