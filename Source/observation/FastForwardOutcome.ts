// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Represents the outcome of fast forwarding an observer.
 */
export enum FastForwardOutcome {
    /** The observer was moved to the tail of the event sequence. */
    FastForwarded = 'FastForwarded',

    /** The observer was already at the tail of the event sequence, so nothing was changed. */
    AlreadyAtTail = 'AlreadyAtTail',

    /** The observer is replaying, so it cannot be fast forwarded until the replay has completed. */
    Replaying = 'Replaying',

    /** The observer is retired or removed, so nothing was changed. */
    NotAvailable = 'NotAvailable'
}
