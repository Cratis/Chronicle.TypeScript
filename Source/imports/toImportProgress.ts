// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { ImportProgressResponse } from '@cratis/chronicle.contracts';
import { fromContractsGuid } from '../connection/Guid.js';
import type { ImportProgress } from './ImportProgress.js';
import type { ImportState } from './ImportState.js';

/**
 * Converts the progress the kernel reports to {@link ImportProgress}.
 * @param progress - The {@link ImportProgressResponse}.
 * @returns The {@link ImportProgress}.
 */
export function toImportProgress(progress: ImportProgressResponse): ImportProgress {
    return {
        importId: fromContractsGuid(progress.ImportId),
        state: progress.State as number as ImportState,
        eventsReceived: Number(progress.EventsReceived),
        eventsStaged: Number(progress.EventsStaged),
        eventsCommitted: Number(progress.EventsCommitted),
        alreadyAppended: Number(progress.AlreadyAppended),
        eventsRejected: Number(progress.RejectedCount)
    };
}
