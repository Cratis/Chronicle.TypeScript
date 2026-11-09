// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Constructor, Guid } from '@cratis/fundamentals';
import type { Identity } from '../identity/Identity.js';
import type { Tag } from '../events/Tag.js';
import type { NamedTag } from '../events/NamedTag.js';

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

    /** Optional subject. Overrides AppendOptions.subject, then the event's @subject() value, then the event source identifier. */
    readonly subject?: string;

    /**
     * Optional tags to associate with the event. These are combined with any static tags
     * declared on the event type via `@tag()`/`@tags()`, and with any tags supplied at
     * append time.
     */
    readonly tags?: ReadonlyArray<string | Tag>;

    /**
     * Optional structured named tags for this event. They are merged, in order, with the shared
     * `AppendOptions.namedTags`; the first occurrence of each exact name and value pair is kept.
     */
    readonly namedTags?: ReadonlyArray<NamedTag>;

    /**
     * Optional registered event source definition (class decorated with `@eventSource`, or its name) for this event.
     * Overrides `AppendOptions.eventSource`, so one batch can mix several event sources.
     */
    readonly eventSource?: Constructor | string;

    /**
     * Optional stream name declared by the event's event source. Overrides `AppendOptions.eventStream`.
     * When this event names a different `eventSource` than the options, the options' stream is not inherited.
     */
    readonly eventStream?: string;

    /**
     * Optional correlation identifier the event had in its source. Used when importing; an append takes the
     * correlation of the call.
     */
    readonly correlationId?: string | Guid;

    /**
     * Optional identity that caused the event in its source. Used when importing; an append records the current identity.
     */
    readonly causedBy?: Identity;

    /**
     * Optional generation of its event type the event was written in. Used when importing; an append writes the
     * generation the event's type is registered with.
     */
    readonly generation?: number;

    /**
     * Optional sequence number the event had in its source. Used when importing, where the kernel keeps it in the
     * event's causation; the event gets a new sequence number in the sequence it is imported into.
     */
    readonly sourceSequenceNumber?: bigint | number;
}
