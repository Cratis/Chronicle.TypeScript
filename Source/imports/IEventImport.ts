// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Guid } from '@cratis/fundamentals';
import type { EventForEventSourceId } from '../eventSequences/EventForEventSourceId.js';
import type { ImportProgress } from './ImportProgress.js';
import type { ImportResult } from './ImportResult.js';

/**
 * Defines an import session that events are added to in chunks, for producers that are not a single stream.
 * @remarks
 * Events are cut into chunks within the kernel's limits and a bounded number of chunks are sent at the same time.
 * Nothing is committed before {@link IEventImport.complete}. A session that is not completed stays open on the kernel,
 * so it can be reattached by its {@link IEventImport.importId}; the kernel abandons it once its staging retention runs out.
 */
export interface IEventImport {
    /** The identifier of the import. */
    readonly importId: Guid;

    /**
     * How many events the kernel already held, in order and without a gap, when this session was attached. A producer
     * that reattaches continues after this many events; a new session starts at zero.
     */
    readonly eventsAcknowledged: number;

    /**
     * Observes the progress of the import as the kernel reports it.
     * @param signal - Ends the observation when aborted.
     * @returns An async iterable of {@link ImportProgress}.
     */
    progress(signal?: AbortSignal): AsyncIterable<ImportProgress>;

    /**
     * Adds events to the import, reading them lazily.
     * @param events - The events, in the order they are to be committed.
     * @param signal - Stops adding when aborted.
     * @returns A promise that resolves once the events are handed to the kernel within the in-flight bound.
     */
    add(events: AsyncIterable<EventForEventSourceId> | Iterable<EventForEventSourceId>, signal?: AbortSignal): Promise<void>;

    /**
     * Completes the import: waits for every chunk to be acknowledged, closes staging and starts the commit.
     * @param signal - Stops waiting when aborted.
     * @returns The {@link ImportResult}, once committed unless {@link ImportOptions.waitForCommit} is false.
     */
    complete(signal?: AbortSignal): Promise<ImportResult>;

    /**
     * Abandons the import, discarding everything staged. Nothing is committed.
     * @param signal - Stops waiting for chunks already being sent; when it aborts first, the import is not abandoned on
     * the kernel, which abandons it once its staging retention runs out.
     * @returns The {@link ImportResult}.
     * @remarks
     * No chunk is sent once abandoning begins. An {@link IEventImport.add} in progress is stopped rather than waited for,
     * and ends with {@link ImportWasAbandoned}. Adding to or completing the import afterwards throws {@link ImportWasAbandoned}.
     */
    abandon(signal?: AbortSignal): Promise<ImportResult>;
}
