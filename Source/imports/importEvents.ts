// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { EventForEventSourceId } from '../eventSequences/EventForEventSourceId.js';
import { beginEventImport } from './beginEventImport.js';
import type { IEventImport } from './IEventImport.js';
import type { ImportOptions } from './ImportOptions.js';
import type { ImportProgress } from './ImportProgress.js';
import type { ImportResult } from './ImportResult.js';
import type { ImportTarget } from './ImportTarget.js';

/**
 * Imports events in one call: begins an import, adds the events as they are read, and completes it.
 * @param target - The {@link ImportTarget}.
 * @param events - The events, in the order they are to be committed. They are read lazily, as they are uploaded.
 * @param options - The {@link ImportOptions}.
 * @returns The {@link ImportResult}.
 */
export async function importEvents(
    target: ImportTarget,
    events: AsyncIterable<EventForEventSourceId> | Iterable<EventForEventSourceId>,
    options?: ImportOptions
): Promise<ImportResult> {
    const session = await beginEventImport(target, options);
    const reporting = options?.onProgress ? report(session, options.onProgress) : undefined;
    try {
        await session.add(events, options?.signal);
        return await session.complete(options?.signal);
    } finally {
        reporting?.abort();
    }
}

function report(session: IEventImport, onProgress: (progress: ImportProgress) => void): AbortController {
    const controller = new AbortController();
    void (async () => {
        try {
            for await (const progress of session.progress(controller.signal)) onProgress(progress);
        } catch {
            // Progress is informational: a failed observation never fails the import.
        }
    })();
    return controller;
}
