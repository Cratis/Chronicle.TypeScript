// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** What a batch method reported for a partition. */
export enum BatchOutcomeKind {
    /** The partition failed. */
    Failed = 'failed',

    /** The partition is delivered again later, without failing. */
    Deferred = 'deferred'
}
