// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { EventSequenceId } from '../eventSequences/EventSequenceId.js';
import type { EventSequenceNumber } from '../eventSequences/EventSequenceNumber.js';
import type { ObserverRunningState } from './ObserverRunningState.js';

/**
 * Represents the state Chronicle reports for one observer, as seen on the event sequence that was asked about.
 */
export interface ObserverState {
    /** The identifier of the observer. */
    readonly id: string;

    /** The event sequence that was asked about. An unknown observer on this sequence reports as not subscribed. */
    readonly eventSequenceId: EventSequenceId;

    /** The state the observer is currently in. */
    readonly runningState: ObserverRunningState;

    /** Whether a client is currently subscribed to the observer. */
    readonly isSubscribed: boolean;

    /** The position of the next event the observer expects to handle. */
    readonly nextEventSequenceNumber: EventSequenceNumber;

    /** The position of the last event the observer handled. */
    readonly lastHandledEventSequenceNumber: EventSequenceNumber;

    /** The position of the tail of the event sequence. */
    readonly tailEventSequenceNumber: EventSequenceNumber;
}
