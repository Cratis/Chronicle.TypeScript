// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { BatchOutcomeKind } from './BatchOutcomeKind.js';

/** A partition a batch method reported it could not handle. */
export interface BatchOutcome {
    /** The partition. */
    readonly partition: string;

    /** The sequence number of the first event not handled. */
    readonly at: bigint;

    /** Whether the partition failed or was deferred. */
    readonly kind: BatchOutcomeKind;

    /** The error describing a failure. */
    readonly error?: unknown;

    /** How long to wait before delivering the partition again, for a deferral. */
    readonly retryAfterMilliseconds: number;
}
