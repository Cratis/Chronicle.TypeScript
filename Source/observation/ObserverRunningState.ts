// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Represents the running state of an observer.
 */
export enum ObserverRunningState {
    /** The observer is in an unknown state. */
    Unknown = 'Unknown',

    /** The observer is active and waiting for new events. */
    Active = 'Active',

    /** The observer is suspended. */
    Suspended = 'Suspended',

    /** The observer is replaying. */
    Replaying = 'Replaying',

    /** The observer is disconnected. */
    Disconnected = 'Disconnected',

    /** The observer is quarantined. */
    Quarantined = 'Quarantined'
}
