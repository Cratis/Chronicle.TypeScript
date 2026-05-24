// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { EventType } from '../Events';

/**
 * Represents a concurrency scope for append operations.
 */
export interface ConcurrencyScope {
    /** The expected sequence number used for concurrency validation. */
    sequenceNumber: bigint;

    /** Whether to include event source identifier as part of the scope. */
    eventSourceId?: boolean;

    /** Optional event stream type to scope to. */
    eventStreamType?: string;

    /** Optional event stream identifier to scope to. */
    eventStreamId?: string;

    /** Optional event source type to scope to. */
    eventSourceType?: string;

    /** Optional event types to scope to. */
    eventTypes?: EventType[];
}
