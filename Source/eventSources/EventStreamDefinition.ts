// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { ConcurrencyDimensionFlags } from './ConcurrencyDimensions.js';

/**
 * Describes an event stream declared by an event source definition.
 */
export interface EventStreamDefinition {
    /** The stable name of the stream; this is the event stream type of appended events. */
    readonly name: string;

    /** The description of the stream. */
    readonly description: string;

    /** The dimensions that take part in concurrency checks for the stream. Falls back to the event source when none. */
    readonly concurrency: ConcurrencyDimensionFlags;
}
