// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { Guid } from '@cratis/fundamentals';
import type { Tag } from '../events/Tag.js';
import type { NamedTag } from '../events/NamedTag.js';
import type { Constructor } from '@cratis/fundamentals';
import type { ConcurrencyScope } from './ConcurrencyScope.js';

/**
 * Options for appending an event to an event sequence.
 */
export interface AppendOptions {
    /** Optional correlation identifier for tracking the append operation. */
    correlationId?: string | Guid;

    /** Optional source type. When omitted or empty, the kernel selects the route. */
    sourceType?: string;

    /** Optional stream type. When omitted or empty, the kernel selects the route. */
    streamType?: string;

    /** Optional stream identifier. When omitted or empty, the kernel selects the route. */
    streamId?: string;

    /** Optional compliance subject. Overrides the event's @subject() value; otherwise defaults to the event source identifier. */
    subject?: string;

    /** Optional occurrence time. When omitted, the kernel supplies the timestamp. */
    occurred?: Date;

    /** Reserved legacy option; does not override the append method's event source identifier. */
    eventSourceId?: string;

    /** Optional concurrency scope to use for append operations. */
    concurrencyScope?: ConcurrencyScope;

    /**
     * Optional tags to associate with the event(s) being appended. These are combined with any
     * static tags declared on the event type(s) via `@tag()`/`@tags()`, and - for the
     * `appendMany(events: EventForEventSourceId[], options?)` overload - with any tags carried
     * by the individual {@link EventForEventSourceId} entries.
     */
    tags?: ReadonlyArray<string | Tag>;

    /**
     * Optional structured named tags shared by every event being appended. For the
     * `appendMany(events: EventForEventSourceId[], options?)` overload they are merged after each entry's own
     * {@link EventForEventSourceId.namedTags}; the first occurrence of each exact name and value pair is kept.
     * When any event ends up with named tags, the append uses the kernel's dedicated named-tag call, so a kernel
     * without named-tag support rejects it instead of silently dropping the tags.
     * @throws {@link InvalidNamedTag} (from the append) when an entry has a blank name or a non-string value.
     */
    namedTags?: ReadonlyArray<NamedTag>;

    /**
     * Optional labeled concurrency scopes, keyed by event source id. Labels need not be append targets.
     * Any target without an explicit scope falls back to {@link concurrencyScope}.
     * The kernel requires at least one event in a batch, so scope-only batches are not supported.
     */
    concurrencyScopes?: Record<string, ConcurrencyScope>;

    /**
     * Routes the append through a registered event source definition: the class decorated with `@eventSource`, or its name.
     * Sets the event source type and the wire `EventSource` key. Explicit `sourceType`/`streamType` values must not contradict it.
     * When no `concurrencyScope` is supplied and the definition declares concurrency dimensions, the scope is derived from them.
     */
    eventSource?: Constructor | string;

    /**
     * The name of a stream declared by {@link eventSource}. Becomes the event stream type. Requires `eventSource`.
     * Use `streamId` for the identifier within the stream.
     */
    eventStream?: string;
}
