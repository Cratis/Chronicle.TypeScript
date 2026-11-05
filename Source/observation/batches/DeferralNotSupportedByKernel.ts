// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Reported when a batch method defers a partition but the kernel does not accept deferred partitions,
 * so the partition is failed instead.
 */
export class DeferralNotSupportedByKernel extends Error {
    /**
     * Creates a new {@link DeferralNotSupportedByKernel}.
     * @param partition - The partition that was deferred.
     */
    constructor(readonly partition: string) {
        super(`Partition '${partition}' was deferred, but the kernel does not accept deferred partitions. The partition is failed instead.`);
        this.name = 'DeferralNotSupportedByKernel';
    }
}
