// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { EventSequenceNumber } from '../eventSequences/EventSequenceNumber.js';
import type { FastForwardOutcome } from './FastForwardOutcome.js';

/**
 * Represents the result of fast forwarding an observer.
 */
export interface FastForwardResult {
    /** What happened. */
    readonly outcome: FastForwardOutcome;

    /** The next event sequence number the observer expected before the fast forward. */
    readonly previousNextEventSequenceNumber: EventSequenceNumber;

    /** The next event sequence number the observer expects after the fast forward. */
    readonly nextEventSequenceNumber: EventSequenceNumber;
}
