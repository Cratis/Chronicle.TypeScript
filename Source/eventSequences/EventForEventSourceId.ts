// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Constructor } from '@cratis/fundamentals';
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

    /** Optional subject. Overrides AppendOptions.subject, then the event's @subject() value, then the event source identifier. */
    readonly subject?: string;

    /**
     * Optional tags to associate with the event. These are combined with any static tags
     * declared on the event type via `@tag()`/`@tags()`, and with any tags supplied at
     * append time.
     */
    readonly tags?: ReadonlyArray<string | Tag>;

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
}
