// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { Guid } from '@cratis/fundamentals';
import type { ConcurrencyScope } from './ConcurrencyScope';

/**
 * Options for appending an event to an event sequence.
 */
export interface AppendOptions {
    /** Optional correlation identifier for tracking the append operation. */
    correlationId?: string | Guid;

    /** Optional explicit sequence number to use for the event. */
    eventSourceId?: string;

    /** Optional concurrency scope to use for append operations. */
    concurrencyScope?: ConcurrencyScope;

    /**
     * Optional per-event-source-id concurrency scopes, keyed by event source id.
     * Only meaningful for the `appendMany(events: EventForEventSourceId[], options?)` overload, which
     * can target multiple distinct event sources in a single batch. When an event source id has no
     * entry here, it falls back to {@link concurrencyScope}.
     */
    concurrencyScopes?: Record<string, ConcurrencyScope>;
}
