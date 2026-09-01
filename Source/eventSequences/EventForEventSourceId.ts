// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Tag } from '../events/Tag';

/**
 * Represents an event paired with the event source identifier it belongs to.
 */
export interface EventForEventSourceId {
    /** The event source identifier for the event. */
    readonly eventSourceId: string;

    /** The event payload to append. */
    readonly event: object;

    /** Optional event stream type to append to. Defaults to the default stream type. */
    readonly eventStreamType?: string;

    /** Optional event stream identifier to append to. Defaults to the event source id. */
    readonly eventStreamId?: string;

    /** Optional event source type to append to. Defaults to the default source type. */
    readonly eventSourceType?: string;

    /** Optional subject identifying the target the event is about. Defaults to the event source id. */
    readonly subject?: string;

    /**
     * Optional tags to associate with the event. These are combined with any static tags
     * declared on the event type via `@tag()`/`@tags()`, and with any tags supplied at
     * append time.
     */
    readonly tags?: ReadonlyArray<string | Tag>;
}
