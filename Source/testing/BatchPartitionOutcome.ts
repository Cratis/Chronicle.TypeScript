// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { BatchOutcome } from '../observation/batches/BatchOutcome.js';

/** A partition a batch method of a scenario reactor reported as failed or deferred. */
export interface BatchPartitionOutcome extends BatchOutcome {
    /** The name of the batch method that reported it. */
    readonly methodName: string;
}
