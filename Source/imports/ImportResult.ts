// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Guid } from '@cratis/fundamentals';
import type { EventSequenceNumber } from '../eventSequences/EventSequenceNumber.js';
import type { ImportRejection } from './ImportRejection.js';
import type { ImportState } from './ImportState.js';

/** The outcome of an import. */
export interface ImportResult {
    /** The identifier of the import. */
    readonly importId: Guid;

    /** The state the import reached. */
    readonly state: ImportState;

    /** How many events were staged. */
    readonly eventsStaged: number;

    /** How many events were committed. */
    readonly eventsCommitted: number;

    /** How many events were already appended under their idempotency key, and so not appended again. */
    readonly alreadyAppended: number;

    /** The first sequence number the import committed, if it committed any. */
    readonly firstSequenceNumber?: EventSequenceNumber;

    /** The last sequence number the import committed, if it committed any. */
    readonly lastSequenceNumber?: EventSequenceNumber;

    /** How many events were rejected, including any beyond the retained {@link ImportResult.rejections}. */
    readonly rejectedCount: number;

    /** The rejected events, each with its index in the import, its event type and the reasons. */
    readonly rejections: readonly ImportRejection[];

    /** Why the import failed or was abandoned, if it was. */
    readonly failureReason?: string;

    /** Whether the import completed. */
    readonly isSuccess: boolean;
}
