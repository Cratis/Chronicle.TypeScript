// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Represents the running state of an observer.
 */
export enum ObserverRunningState {
    /** The observer is in an unknown state. */
    Unknown = 'Unknown',

    /** The observer is subscribing to the event sequence. */
    Subscribing = 'Subscribing',

    /** The observer is replaying events from the beginning. */
    Replaying = 'Replaying',

    /** The observer is resuming after a pause. */
    Resuming = 'Resuming',

    /** The observer is actively processing events. */
    Active = 'Active',

    /** The observer is paused and not processing events. */
    Paused = 'Paused',

    /** The observer has stopped processing events. */
    Stopped = 'Stopped',

    /** The observer is in a failed state. */
    Failed = 'Failed',

    /** The observer has been disconnected. */
    Disconnected = 'Disconnected'
}
