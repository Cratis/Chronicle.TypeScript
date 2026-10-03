// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Constructor } from '@cratis/fundamentals';
import type { ConcurrencyDimensionFlags } from './ConcurrencyDimensions.js';
import type { EventStreamDefinition } from './EventStreamDefinition.js';

/**
 * Describes a registered event source: a stable name, its default concurrency dimensions and its streams.
 * Routing belongs to the append, not to event types.
 */
export interface EventSourceDefinition {
    /** The class carrying the definition. */
    readonly type: Constructor;

    /** The stable name of the event source; this is the event source type of appended events. */
    readonly name: string;

    /** The description of the event source. */
    readonly description: string;

    /** The default dimensions that take part in concurrency checks. */
    readonly concurrency: ConcurrencyDimensionFlags;

    /** The streams declared by the event source. */
    readonly streams: ReadonlyArray<EventStreamDefinition>;
}
