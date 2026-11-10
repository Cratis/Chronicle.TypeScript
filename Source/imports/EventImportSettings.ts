// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Guid } from '@cratis/fundamentals';
import type { ImportEvent, ImportsClient } from '@cratis/chronicle.contracts';
import type { EventForEventSourceId } from '../eventSequences/EventForEventSourceId.js';
import type { ImportOptions } from './ImportOptions.js';

/** What an {@link EventImport} session is created with. */
export interface EventImportSettings {
    /** The Imports service. */
    readonly imports: ImportsClient;

    /** The name of the event store. */
    readonly eventStore: string;

    /** The namespace. */
    readonly namespace: string;

    /** The identifier of the import. */
    readonly importId: Guid;

    /** The {@link ImportOptions}. */
    readonly options: ImportOptions;

    /** The most events the kernel accepts in one chunk; zero or less means no limit. */
    readonly maxChunkEvents: number;

    /** The most bytes of event content the kernel accepts in one chunk; zero or less means no limit. */
    readonly maxChunkBytes: number;

    /** Converts an event to its wire form. */
    readonly convert: (event: EventForEventSourceId) => ImportEvent;

    /** How many chunks the kernel already holds without a gap, when reattaching. */
    readonly acknowledgedChunks?: number;

    /** How many events those chunks carry, when reattaching. */
    readonly acknowledgedEvents?: number;

    /** The delay, in milliseconds, before an attempt to send a chunk again. */
    readonly retryDelay?: (attempt: number) => number;

    /** The interval, in milliseconds, between reads of the import while waiting for its commit. */
    readonly pollInterval?: number;
}
