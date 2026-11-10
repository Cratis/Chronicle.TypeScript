// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { ImportProgressResponse } from '@cratis/chronicle.contracts';
import { fromContractsGuid } from '../connection/Guid.js';
import { EventSequenceNumber } from '../eventSequences/EventSequenceNumber.js';
import type { ImportResult } from './ImportResult.js';
import { ImportState } from './ImportState.js';

/**
 * Converts the progress the kernel reports to the {@link ImportResult} it amounts to.
 * @param progress - The {@link ImportProgressResponse}.
 * @returns The {@link ImportResult}.
 */
export function toImportResult(progress: ImportProgressResponse): ImportResult {
    const state = progress.State as number as ImportState;
    // Sequence numbers are only meaningful once the import committed something.
    const committed = progress.EventsCommitted > 0n;
    return {
        importId: fromContractsGuid(progress.ImportId),
        state,
        eventsStaged: Number(progress.EventsStaged),
        eventsCommitted: Number(progress.EventsCommitted),
        alreadyAppended: Number(progress.AlreadyAppended),
        firstSequenceNumber: committed ? new EventSequenceNumber(progress.FirstSequenceNumber) : undefined,
        lastSequenceNumber: committed ? new EventSequenceNumber(progress.LastSequenceNumber) : undefined,
        rejectedCount: Number(progress.RejectedCount),
        rejections: (progress.Rejections ?? []).map(rejection => ({
            index: Number(rejection.Index),
            eventType: rejection.EventType,
            reasons: [...rejection.Reasons]
        })),
        failureReason: progress.FailureReason ? progress.FailureReason : undefined,
        isSuccess: state === ImportState.Completed
    };
}
