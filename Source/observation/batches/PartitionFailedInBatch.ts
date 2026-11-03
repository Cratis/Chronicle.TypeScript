// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Reported when a batch method fails a partition without giving a reason. */
export class PartitionFailedInBatch extends Error {
    /**
     * Creates a new {@link PartitionFailedInBatch}.
     * @param partition - The partition that was failed.
     */
    constructor(readonly partition: string) {
        super(`Partition '${partition}' was failed by a batch method.`);
        this.name = 'PartitionFailedInBatch';
    }
}
