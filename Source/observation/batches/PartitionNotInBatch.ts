// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Thrown when a batch method reports an outcome for a partition the batch holds no events for. */
export class PartitionNotInBatch extends Error {
    /**
     * Creates a new {@link PartitionNotInBatch}.
     * @param partition - The partition the outcome was reported for.
     */
    constructor(readonly partition: string) {
        super(`The batch holds no events for partition '${partition}', so no outcome can be reported for it.`);
        this.name = 'PartitionNotInBatch';
    }
}
