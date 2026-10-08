// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { NamedTag } from '../events/NamedTag.js';
import type { Tag } from '../events/Tag.js';
import type { ConcurrencyScope } from '../eventSequences/ConcurrencyScope.js';
import type { TransactionalEventRouting } from './TransactionalEventRouting.js';

/**
 * Optional append metadata for an event added to a unit of work.
 * Every value is kept with the event and carried to the append when the unit of work commits,
 * where it is validated like any other append.
 */
export interface TransactionalAppendOptions extends TransactionalEventRouting {
    /** Optional stream type. When omitted or empty, the kernel selects the route. */
    readonly eventStreamType?: string;

    /** Optional stream identifier. When omitted or empty, the kernel selects the route. */
    readonly eventStreamId?: string;

    /** Optional source type. When omitted or empty, the kernel selects the route. */
    readonly eventSourceType?: string;

    /** Optional occurrence time. When omitted, the kernel supplies the timestamp. */
    readonly occurred?: Date;

    /** Optional compliance subject. Overrides the event's @subject() value; otherwise defaults to the event source identifier. */
    readonly subject?: string;

    /** Optional tags, combined with any static tags declared on the event type via `@tag()`/`@tags()`. */
    readonly tags?: ReadonlyArray<string | Tag>;

    /**
     * Optional concurrency scope for the event source identifier, validated when the unit of work commits.
     * Chronicle accepts one scope per event source identifier in an append, so every event a unit of work holds
     * for the same event source identifier in the same event sequence must use an equal scope or none.
     */
    readonly concurrencyScope?: ConcurrencyScope;

    /**
     * Structured named tags for the event. Validated when the event is added, so an invalid tag fails
     * before anything is committed; the first occurrence of each exact name and value pair is kept.
     */
    readonly namedTags?: ReadonlyArray<NamedTag>;
}
