// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Guid } from '@cratis/fundamentals';
import type { ImportState } from './ImportState.js';

/** The progress of an import as the kernel reports it. */
export interface ImportProgress {
    /** The identifier of the import. */
    readonly importId: Guid;

    /** The state the import is in. */
    readonly state: ImportState;

    /** How many events the kernel has received. */
    readonly eventsReceived: number;

    /** How many events are staged. */
    readonly eventsStaged: number;

    /** How many events are committed. */
    readonly eventsCommitted: number;

    /** How many events were already appended under their idempotency key, and so not appended again. */
    readonly alreadyAppended: number;

    /** How many events were rejected. */
    readonly eventsRejected: number;
}
