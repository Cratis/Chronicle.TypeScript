// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Represents the outcome Chronicle reports when asked to retry a failed partition of an observer.
 * None of the values means the partition has recovered; observe progress through the failed partitions and observer state.
 */
export enum PartitionRetryOutcome {
    /** The value Chronicle sent is not recognized by this client. It is not success. */
    Unknown = 'Unknown',

    /** A recovery job was started or resumed for the partition. This is acceptance, not recovery. */
    Started = 'Started',

    /** No failure is recorded for the partition: it was already cleared, never failed, or the observer is unknown or retired. */
    PartitionNotFound = 'PartitionNotFound',

    /** The observer is quarantined, so the retry is refused until the quarantine is cleared. */
    ObserverQuarantined = 'ObserverQuarantined',

    /** The partition is quarantined, so the retry is refused until the quarantine is cleared. */
    PartitionQuarantined = 'PartitionQuarantined'
}
