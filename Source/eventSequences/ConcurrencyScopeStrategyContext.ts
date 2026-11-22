// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { AppendOptions } from './AppendOptions.js';
import type { EventForEventSourceId } from './EventForEventSourceId.js';
import type { TailReader } from './resolveEventSourceRouting.js';

/** Inputs to a custom strategy, called once per event source id without an explicit scope. */
export interface ConcurrencyScopeStrategyContext {
    /** The event source id whose scope is being resolved. */
    readonly eventSourceId: string;
    /** All entries for this id in the append. Per-entry routing overrides the shared options. */
    readonly events: readonly EventForEventSourceId[];
    /** The shared options supplied to the append. */
    readonly options?: AppendOptions;
    /** Read this sequence's tail, optionally filtered by source id, source type, stream type and stream id. */
    readonly readTail: TailReader;
}
