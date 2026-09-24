// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Tag } from '../events/Tag.js';

/**
 * Represents an event paired with the event source identifier it belongs to.
 */
export interface EventForEventSourceId {
    /** The event source identifier for the event. */
    readonly eventSourceId: string;

    /** The event payload to append. */
    readonly event: object;

    /** Optional stream type. Overrides AppendOptions.streamType; the kernel resolves an omitted or empty route. */
    readonly eventStreamType?: string;

    /** Optional stream identifier. Overrides AppendOptions.streamId; the kernel resolves an omitted or empty route. */
    readonly eventStreamId?: string;

    /** Optional source type. Overrides AppendOptions.sourceType; the kernel resolves an omitted or empty route. */
    readonly eventSourceType?: string;

    /** Optional occurrence time. Overrides the shared occurrence time. */
    readonly occurred?: Date;

    /** Optional subject. Overrides AppendOptions.subject; otherwise falls back to the event source identifier. */
    readonly subject?: string;

    /**
     * Optional tags to associate with the event. These are combined with any static tags
     * declared on the event type via `@tag()`/`@tags()`, and with any tags supplied at
     * append time.
     */
    readonly tags?: ReadonlyArray<string | Tag>;
}
