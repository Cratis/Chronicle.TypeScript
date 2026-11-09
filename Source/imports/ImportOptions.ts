// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Guid } from '@cratis/fundamentals';
import type { ImportProgress } from './ImportProgress.js';
import type { OnInvalidEvent } from './OnInvalidEvent.js';

/** Options for importing events into an event sequence. */
export interface ImportOptions {
    /** What the import does when one of its events is invalid. Defaults to {@link OnInvalidEvent.Reject}: nothing is committed. */
    readonly onInvalid?: OnInvalidEvent;

    /** Whether completing the import waits until it is committed. Defaults to true. */
    readonly waitForCommit?: boolean;

    /** How many chunks are sent to the kernel at the same time. Defaults to 4. */
    readonly maxChunksInFlight?: number;

    /** The most events the client puts in one chunk; the kernel's own limit applies when it is lower. */
    readonly maxEventsPerChunk?: number;

    /**
     * The identifier to give the import; a new one is created when not set. Beginning an import with an identifier
     * that already exists returns that import.
     */
    readonly importId?: string | Guid;

    /** How many times a chunk is sent after the connection fails. Resending is safe: the kernel stages a chunk once. Defaults to 5. */
    readonly maxChunkAttempts?: number;

    /** Cancels the import. Chunks the kernel already holds stay staged, so the import can be reattached by its identifier. */
    readonly signal?: AbortSignal;

    /** Called with the progress of the import as the kernel reports it, until the import call returns. */
    readonly onProgress?: (progress: ImportProgress) => void;
}
