// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { Guid } from '@cratis/fundamentals';

/**
 * Options for appending an event to an event sequence.
 */
export interface AppendOptions {
    /** Optional correlation identifier for tracking the append operation. */
    correlationId?: string | Guid;

    /** Optional explicit sequence number to use for the event. */
    eventSourceId?: string;
}
