// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { ObserverRunningState } from '../observation/ObserverRunningState';
import { EventSequenceNumber } from '../eventSequences/EventSequenceNumber';

/**
 * Represents the state of a projection.
 */
export interface ProjectionState {
    /** The current running state of the projection. */
    readonly runningState: ObserverRunningState;

    /** Indicates whether the projection is subscribed to its handler. */
    readonly isSubscribed: boolean;

    /** The next event sequence number the projection will process. */
    readonly nextEventSequenceNumber: EventSequenceNumber;

    /** The last event sequence number the projection handled. */
    readonly lastHandledEventSequenceNumber: EventSequenceNumber;

    /** The current tail event sequence number of the event sequence the projection observes. */
    readonly tailEventSequenceNumber: EventSequenceNumber;
}
