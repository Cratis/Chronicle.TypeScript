// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { EventSequenceId } from '../eventSequences/EventSequenceId.js';
import { EventSequenceNumber } from '../eventSequences/EventSequenceNumber.js';
import { ObserverRunningState } from './ObserverRunningState.js';
import { ObserverType } from './ObserverType.js';

/**
 * Represents what the event store knows about one of its observers.
 */
export interface ObserverInformation {
    /** The identifier of the observer. */
    readonly id: string;

    /** The event sequence the observer observes. */
    readonly eventSequenceId: EventSequenceId;

    /** What kind of observer this is. */
    readonly type: ObserverType;

    /** The state the observer is currently in. */
    readonly runningState: ObserverRunningState;

    /** The position of the last event the observer handled. */
    readonly lastHandledEventSequenceNumber: EventSequenceNumber;

    /** The position of the next event the observer expects to handle. */
    readonly nextEventSequenceNumber: EventSequenceNumber;

    /** The total number of events the observer has handled. */
    readonly handledEventCount: bigint;
}
